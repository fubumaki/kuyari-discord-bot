import OpenAI from 'openai';

const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY!,
});

const DEFAULT_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = 512;

export async function llmReply(system: string, user: string): Promise<string> {
	const res = await client.chat.completions.create({
		model: DEFAULT_MODEL,
		temperature: 0.6,
		max_tokens: MAX_TOKENS,
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: user },
		],
	});
	return res.choices?.[0]?.message?.content?.trim() || '…';
}


