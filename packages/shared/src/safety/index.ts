import { classify } from './classify';
import { isIllegal, refusalMessage, applyMasking } from './policy';

export { classify, isIllegal, refusalMessage, applyMasking };

// Wrap a token stream and apply policy per chunk; if illegal, short-refuse once.
export async function* applySafetyStream(stream: AsyncIterable<string>, level: number): AsyncGenerator<string> {
  let total = '';
  for await (const chunk of stream) {
    total += chunk;
    const flags = classify(total);
    if (isIllegal(flags)) {
      yield refusalMessage();
      return;
    }
    yield applyMasking(chunk, level);
  }
}

