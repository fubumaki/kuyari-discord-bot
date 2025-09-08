import OpenAI from 'openai';
import { routeModel, type PlanName } from '@kuyari/shared/modelRouter';

const MAX_TOKENS = 512;

function makeOpenAIClient(apiKey?: string) {
	return new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY! });
}

export async function llmReply(
	system: string,
	user: string,
	opts: { plan: PlanName; capability?: 'text_basic'; providerKey?: string } 
): Promise<string> {
	const capability = opts.capability ?? 'text_basic';
	const model = routeModel(opts.plan, capability);
	if (model.provider === 'open') {
		const client = makeOpenAIClient(opts.providerKey);
		const res = await client.chat.completions.create({
			model: process.env.LLM_MODEL || model.model,
			temperature: 0.6,
			max_tokens: MAX_TOKENS,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user },
			],
		});
		return res.choices?.[0]?.message?.content?.trim() || '…';
	}
	// TODO: add other providers when wired
	return 'Provider not configured.';
}


