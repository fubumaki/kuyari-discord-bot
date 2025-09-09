import { z } from 'zod';

export const Env = z.object({
	DISCORD_PUBLIC_KEY: z.string().optional(),
	DISCORD_CLIENT_ID: z.string().optional(),
	DISCORD_CLIENT_SECRET: z.string().optional(),
	DISCORD_BOT_TOKEN: z.string().optional(),

	STRIPE_SECRET_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),

	DATABASE_URL: z.string().optional(),

	UPSTASH_REDIS_URL: z.string().optional(),
	UPSTASH_REDIS_TOKEN: z.string().optional(),

	KEY_ENCRYPTION_KEY_B64: z.string().optional(),
});

export type EnvT = z.infer<typeof Env>;

export function loadEnv(): EnvT {
	return Env.parse(process.env);
}



