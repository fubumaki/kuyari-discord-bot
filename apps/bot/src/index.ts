import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction, Events, Partials } from 'discord.js';
import { llmReply } from './llm';
import { getEntitlement, initEntitlementSubscription } from '@kuyari/shared';

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
  new SlashCommandBuilder().setName('plan').setDescription('Show the guild plan').toJSON(),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands });
}

client.on('ready', () => console.log(`Logged in as ${client.user?.tag}`));
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName === 'plan') {
    if (!i.guildId) {
      await i.reply('This command must be used in a guild.');
      return;
    }
    const ent = await getEntitlement(i.guildId);
    await (i as ChatInputCommandInteraction).reply(
      `Plan: **${ent.plan}**  |  DJ slots: ${ent.caps.dj_concurrency}`
    );
  }
});

// Mention-to-LLM reply
client.on(Events.MessageCreate, async (message) => {
	try {
		if (message.author.bot || message.webhookId) return;
		if (!message.guild) return;
		if (!message.mentions.has(client.user)) return;

		const raw = message.content ?? '';
		const cleaned = raw.replace(new RegExp(`<@!?${client.user?.id}>`, 'g'), '').trim();

		const thinking = await message.reply('…');
		const systemPrompt = [
			'You are Kuyari, a helpful, concise Discord assistant.',
			'Be brief. No sensitive data. Suggest slash commands when appropriate.',
		].join(' ');
		const answer = await llmReply(systemPrompt, cleaned || 'Say hello and suggest /help.');
		await thinking.edit(answer.slice(0, 1900));
	} catch (err) {
		console.error('mention handler error:', err);
	}
});

registerCommands().then(() => client.login(process.env.DISCORD_BOT_TOKEN));
