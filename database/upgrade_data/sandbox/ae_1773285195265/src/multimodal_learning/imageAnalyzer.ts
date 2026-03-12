export class ImageAnalyzer {
  describe(content: string): { concepts: string[]; diagrams: string[] } {
    const cleaned = content.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 3);
    const concepts = Array.from(new Set(cleaned)).slice(0, 6);
    const diagrams = concepts.filter((c) => c.includes('diagram') || c.includes('flow')); 
    return { concepts, diagrams: diagrams.length ? diagrams : ['visual concept'] };
  }
}
