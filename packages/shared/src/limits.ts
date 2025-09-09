import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL!, token: process.env.UPSTASH_REDIS_TOKEN! });

type Plan = 'free' | 'pro' | 'premium';

const budgets: Record<Plan, { requests: number; windowSec: number }> = {
	free: { requests: 60, windowSec: 300 },
	pro: { requests: 600, windowSec: 300 },
	premium: { requests: 5000, windowSec: 300 },
};

export function limiterFor(plan: Plan) {
	const b = budgets[plan] ?? budgets.free;
	return new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(b.requests, `${b.windowSec} s`) });
}



