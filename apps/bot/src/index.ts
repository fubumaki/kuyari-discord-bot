import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction, Events, Partials } from 'discord.js';
import { getEntitlement, initEntitlementSubscription, applySafetyStream, generateStream, anonymizeId, logMetric, getGuildLLMConfig, loadDecryptedKey } from '@kuyari/shared';
import { withTyping } from './typing';
import { chunkForDiscord } from './chunk';
import { sendQueued, editQueued, replyWithPacing } from './queue';

// Initialize Redis pub/sub subscription for entitlement changes
initEntitlementSubscription();

// Create a new Discord client with message content to support mention replies
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel],
});

// Define grouped slash commands: /bot <subcommand>
const commands = [
  new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot commands')
    .addSubcommand((sc) => sc.setName('ping').setDescription('Test the bot connection'))
    .addSubcommand((sc) => sc.setName('status').setDescription('Show the server plan and status'))
    .addSubcommand((sc) =>
      sc
        .setName('play')
        .setDescription('Play audio in your voice channel')
        .addStringOption((o) => o.setName('query').setDescription('Song name or URL').setRequired(true))
    )
    .addSubcommand((sc) => sc.setName('stop').setDescription('Stop playback'))
    .addSubcommand((sc) => sc.setName('skip').setDescription('Skip current track'))
    .addSubcommand((sc) => sc.setName('queue').setDescription('Show the queue'))
    .toJSON(),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands });
}

client.on('ready', () => console.log(`Logged in as ${client.user?.tag}`));
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;
  try {
    if (i.commandName === 'bot') {
      const sub = i.options.getSubcommand();
      if (sub === 'ping') {
        await i.reply({ content: 'Pong!', ephemeral: true });
        return;
      }
      if (sub === 'status') {
        await i.deferReply({ ephemeral: true });
        if (!i.guildId) {
          await i.editReply('This command must be used in a guild.');
          return;
        }
        const ent = await getEntitlement(i.guildId);
        await i.editReply(`Plan: **${ent.plan}**  |  DJ slots: ${ent.caps.dj_concurrency}`);
        return;
      }
      if (sub === 'play') {
        const query = i.options.getString('query', true);
        await i.reply({ content: `🎵 (stub) Playing: ${query}`, ephemeral: true });
        return;
      }
      if (sub === 'stop') {
        await i.reply({ content: '⏹️ (stub) Music stopped.', ephemeral: true });
        return;
      }
      if (sub === 'skip') {
        await i.reply({ content: '⏭️ (stub) Skipped to next song.', ephemeral: true });
        return;
      }
      if (sub === 'queue') {
        await i.reply({ content: '📋 (stub) Current queue is empty.', ephemeral: true });
        return;
      }
    }
  } catch (err) {
    try { await i.reply({ content: 'Interaction failed.', ephemeral: true }); } catch {}
    console.error('interaction error:', err);
  }
});

// Mention-to-LLM reply
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || message.webhookId) return;
    if (!message.guild) return;
    if (!message.mentions.has(client.user!)) return;

    const raw = message.content ?? '';
    const cleaned = raw.replace(new RegExp(`<@!?${client.user?.id}>`, 'g'), '').trim() || 'Say hello.';

    const guildId = message.guild.id;
    const ent = await getEntitlement(guildId);
    const cfg = await getGuildLLMConfig(guildId);
    const key = await loadDecryptedKey(guildId);

    await withTyping(message.channel, async () => {
      if (!key) {
        await message.reply({
          content: `I don’t have an API key for this server. Ask an admin to run /llm set-key to enable AI replies.`,
          allowedMentions: { repliedUser: true },
        });
        return;
      }

      const provider = (cfg.provider as any) || (ent.plan === 'basic' ? 'anthropic' : 'openai');
      const model = (cfg.model as any) || (provider === 'anthropic' ? 'claude-3-haiku-20240307' : process.env.LLM_MODEL || 'gpt-4o-mini');

      // user moderation level defaults to 3
      let userLevel = 3;
      try {
        const row = await (await import('@kuyari/db')).db.userPrefs.get({ where: { userId: message.author.id, guildId } });
        userLevel = row?.moderation_level ?? 3;
      } catch {}

      const stream = generateStream({ provider, model, apiKey: key, prompt: cleaned, maxSentences: 2, temperature: 0.3 });
      const safeStream = applySafetyStream(stream, userLevel);

      // Post a placeholder quickly, then edit in place as tokens arrive
      const placeholder = await replyWithPacing(message, { content: '…', allowedMentions: { repliedUser: false } });

      const MAX_EDIT = 1900; // keep headroom under Discord limit
      let buffer = '';
      let lastPushed = '';
      let lastEdit = 0;
      const editIntervalMs = 180;

      for await (const chunk of safeStream) {
        buffer += chunk;
        const now = Date.now();
        if (now - lastEdit >= editIntervalMs || /[\.\!\?]\s$/.test(buffer)) {
          const next = buffer.length > MAX_EDIT ? buffer.slice(0, MAX_EDIT - 1) + '…' : buffer;
          if (next !== lastPushed) {
            editQueued(placeholder, { content: next });
            lastPushed = next;
            lastEdit = now;
          }
        }
      }

      // Finalize: if over limit, chunk and send remaining parts
      if (!buffer.trim()) {
        editQueued(placeholder, { content: '…' });
      } else {
        const chunks = Array.from(chunkForDiscord(buffer));
        if (chunks.length === 0) {
          editQueued(placeholder, { content: '…' });
        } else {
          // Edit first chunk into the placeholder, then queue the rest
          editQueued(placeholder, { content: chunks[0] });
          for (let i = 1; i < chunks.length; i++) {
            sendQueued(message.channel, { content: chunks[i], allowedMentions: { repliedUser: false } });
          }
        }
      }

      // Metrics (no raw content)
      try {
        const meta = await (stream as any).meta;
        logMetric({
          kind: 'llm',
          provider, model,
          latency_ms_first_token: meta.firstTokenMs,
          latency_ms_total: meta.totalMs,
          tokens_out: meta.completionTokens,
          result_code: 'ok',
          guild_anonymized: anonymizeId(guildId),
          user_anonymized: anonymizeId(message.author.id),
        });
      } catch {}
    });
  } catch (err) {
    console.error('mention handler error:', err);
    try { await message.reply('Sorry—something went wrong.'); } catch {}
  }
});

registerCommands().then(() => client.login(process.env.DISCORD_BOT_TOKEN));
