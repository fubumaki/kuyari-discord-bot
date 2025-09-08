export function* chunkForDiscord(content: string): Generator<string> {
  // Prefer split on paragraph/sentence boundaries, then hard chunk
  const MAX = 1900; // keep headroom for formatting
  if (content.length <= MAX) { yield content; return; }
  const boundaries = content.split(/(\n\n|\.\s)/g); // retain delimiters
  let buf = '';
  for (const part of boundaries) {
    if (buf.length + part.length > MAX) {
      if (buf) { yield buf + '…'; }
      if (part.length > MAX) {
        // hard chop long part
        let i = 0;
        while (i < part.length) {
          const slice = part.slice(i, i + MAX);
          yield slice + (i + MAX < part.length ? '…' : '');
          i += MAX;
        }
        buf = '';
      } else {
        buf = part;
      }
    } else {
      buf += part;
    }
  }
  if (buf) yield buf;
}

