// Minimal SSE line parser that yields JSON objects or strings from a text/event-stream
export async function* parseSSELines(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let yieldedAny = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          return;
        }
        yieldedAny = true;
        yield data;
      }
    }
  }
  if (!yieldedAny && buffer) {
    // Some providers may send single-shot without newlines
    yield buffer;
  }
}

