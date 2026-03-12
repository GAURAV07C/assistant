export class TranscriptExtractor {
  normalize(transcript: string[]): string[] {
    const cleaned = transcript
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length > 5);
    return cleaned;
  }

  toParagraphs(transcript: string[]): string[] {
    const out: string[] = [];
    let buffer = '';
    for (const line of transcript) {
      buffer += `${line} `;
      if (line.endsWith('.') || line.endsWith('!') || line.endsWith('?')) {
        out.push(buffer.trim());
        buffer = '';
      }
    }
    if (buffer.trim()) out.push(buffer.trim());
    return out;
  }
}
