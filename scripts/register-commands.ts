// scripts/register-commands.ts
import 'dotenv/config';

const APP_ID = process.env.DISCORD_CLIENT_ID!;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

// Grouped /bot command structure + /llm management
const commands = [
  {
    name: 'bot',
    description: 'Bot commands',
    dm_permission: false,
    options: [
      { type: 1, name: 'ping', description: 'Test the bot connection' },
      { type: 1, name: 'status', description: 'Show the server plan and status' },
      {
        type: 1,
        name: 'play',
        description: 'Play audio in your voice channel',
        options: [{ type: 3, name: 'query', description: 'Song name or URL', required: true }],
      },
      { type: 1, name: 'stop', description: 'Stop playback' },
      { type: 1, name: 'skip', description: 'Skip current track' },
      { type: 1, name: 'queue', description: 'Show the queue' },
    ],
  },
  {
    name: 'llm',
    description: 'Manage AI settings',
    dm_permission: false,
    options: [
      {
        type: 1, // SUB_COMMAND
        name: 'set-key',
        description: 'Set provider API key (per guild)',
        options: [
          {
            type: 3,
            name: 'provider',
            description: 'anthropic|openai|open|gemini',
            required: false,
            choices: [
              { name: 'anthropic', value: 'anthropic' },
              { name: 'openai', value: 'openai' },
              { name: 'open', value: 'open' },
              { name: 'gemini', value: 'gemini' },
            ],
          },
          { type: 3, name: 'key', description: 'API key', required: true },
        ],
      },
      { type: 1, name: 'unset-key', description: 'Remove stored API key' },
      {
        type: 1,
        name: 'model',
        description: 'Get or set active model',
        options: [{ type: 3, name: 'name', description: 'Model identifier', required: false }],
      },
      { type: 1, name: 'test', description: 'Run a minimal LLM test' },
    ],
  },
];

async function main() {
  console.log('Registering Discord slash commands...');
  
  const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify(commands),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Failed to register commands:', errorText);
    process.exit(1);
  }
  
  const registeredCommands = await res.json();
  console.log(`Successfully registered ${registeredCommands.length} commands:`);
  registeredCommands.forEach((cmd: any) => {
    console.log(`- /${cmd.name}: ${cmd.description}`);
  });
}

main().catch((error) => {
  console.error('Error registering commands:', error);
  process.exit(1);
});

