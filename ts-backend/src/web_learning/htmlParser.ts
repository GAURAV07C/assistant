export class HtmlParser {
  extractText(html: string): string {
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  extractSections(html: string): string[] {
    const matches = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi) || [];
    return matches.map((m) => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  }

  extractCode(html: string): string[] {
    const matches = html.match(/<code[^>]*>([\s\S]*?)<\/code>/gi) || [];
    return matches.map((c) => c.replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 5);
  }
}
