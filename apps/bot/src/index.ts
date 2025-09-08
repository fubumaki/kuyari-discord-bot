import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction, Events, Partials } from 'discord.js';
import { getEntitlement, initEntitlementSubscription, applySafetyStream, generateStream, anonymizeId, logMetric, getGuildLLMConfig, loadDecryptedKey } from '@kuyari/shared';
import { withTyping } from './typing';
import { chunkForDiscord } from './chunk';
import { sendQueued } from './queue';

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

// Define slash commands to register (only /plan for now)
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!').toJSON(),
  new SlashCommandBuilder().setName('plan').setDescription('Show the guild plan').toJSON(),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands });
}

client.on('ready', () => console.log(`Logged in as ${client.user?.tag}`));
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;
  try {
    if (i.commandName === 'ping') {
      await i.reply({ content: 'Pong!', ephemeral: true });
      return;
    }
    if (i.commandName === 'plan') {
      await i.deferReply({ ephemeral: true });
      if (!i.guildId) {
        await i.editReply('This command must be used in a guild.');
        return;
      }
      const ent = await getEntitlement(i.guildId);
      await i.editReply(`Plan: **${ent.plan}**  |  DJ slots: ${ent.caps.dj_concurrency}`);
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

      // Aggregate full text then chunk to respect 2k limit
      let full = '';
      for await (const chunk of safeStream) {
        full += chunk;
      }

      let sentAny = false;
      for (const chunk of chunkForDiscord(full)) {
        sendQueued(message.channel, { content: chunk, allowedMentions: { repliedUser: false } });
        sentAny = true;
      }
      if (!sentAny) {
        await message.reply('…');
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
