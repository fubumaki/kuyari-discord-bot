// scripts/register-commands.ts
import 'dotenv/config';

const APP_ID = process.env.DISCORD_CLIENT_ID!;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

// Example: /plan
const commands = [
  {
    name: 'plan',
    description: 'Show plans or manage subscription',
    options: [
      {
        type: 3, // STRING
        name: 'action',
        description: 'view|subscribe|cancel',
        required: false,
        choices: [
          { name: 'view', value: 'view' },
          { name: 'subscribe', value: 'subscribe' },
          { name: 'cancel', value: 'cancel' },
        ],
      },
    ],
    dm_permission: false,
  },
  {
    name: 'ping',
    description: 'Test the bot connection',
    dm_permission: false,
  },
  {
    name: 'dj',
    description: 'DJ commands for music functionality',
    options: [
      {
        type: 3, // STRING
        name: 'action',
        description: 'play|stop|skip|queue',
        required: true,
        choices: [
          { name: 'play', value: 'play' },
          { name: 'stop', value: 'stop' },
          { name: 'skip', value: 'skip' },
          { name: 'queue', value: 'queue' },
        ],
      },
      {
        type: 3, // STRING
        name: 'query',
        description: 'Song name or URL to play',
        required: false,
      },
    ],
    dm_permission: false,
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

