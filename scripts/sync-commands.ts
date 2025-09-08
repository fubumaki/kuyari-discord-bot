import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

async function main() {
	const token = process.env.DISCORD_BOT_TOKEN;
	const appId = process.env.DISCORD_CLIENT_ID;
	const guildId = process.env.TEST_GUILD_ID;
	if (!token || !appId || !guildId) {
		console.error('Missing DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID or TEST_GUILD_ID');
		process.exit(1);
	}

	const commands = [
		new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!').toJSON(),
	];

	const rest = new REST({ version: '10' }).setToken(token);
	await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
	console.log('Guild commands registered for', guildId);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});


