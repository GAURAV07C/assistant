import type { FileAnalysis } from './fileAnalyzer.js';

const KNOWN_FEATURES: Array<{ name: string; keywords: string[] }> = [
  { name: 'coding agent', keywords: ['coding_agent', 'CodingAgent'] },
  { name: 'learning engine', keywords: ['learning_engine', 'ContinuousLearningEngine', 'CurriculumEngine'] },
  { name: 'voice system', keywords: ['voiceService', 'TTSService'] },
  { name: 'computer control', keywords: ['terminal_tools', 'automation_agent'] },
  { name: 'youtube learning', keywords: ['YouTubeLearningAgent', 'youtube_learning'] },
  { name: 'github learning', keywords: ['GitHubLearningAgent', 'github_learning'] },
  { name: 'multimodal learning', keywords: ['MultimodalLearningAgent', 'multimodal_learning'] },
];

export interface FeatureReport {
  implemented: string[];
  missing: string[];
  details: Record<string, string[]>;
}

export class FeatureDetector {
  detect(analysis: FileAnalysis[]): FeatureReport {
    const implemented: string[] = [];
    const missing: string[] = [];
    const details: Record<string, string[]> = {};

    const texts = analysis.map((file) => ({ path: file.relative, text: file.text }));
    for (const feature of KNOWN_FEATURES) {
      const hits = texts.filter((item) => feature.keywords.some((keyword) => item.text.includes(keyword) || item.path.includes(keyword)));
      if (hits.length) {
        implemented.push(feature.name);
        details[feature.name] = hits.map((hit) => hit.path);
      } else {
        missing.push(feature.name);
        details[feature.name] = [];
      }
    }

    return { implemented, missing, details };
  }
}
