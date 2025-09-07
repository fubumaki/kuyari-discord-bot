import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getEntitlement, initEntitlementSubscription } from '@kuyari/shared';

// Initialize Redis pub/sub subscription for entitlement changes
initEntitlementSubscription();

// Create a new Discord client with minimal intents (Guilds and Voice States)
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

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

registerCommands().then(() => client.login(process.env.DISCORD_BOT_TOKEN));
