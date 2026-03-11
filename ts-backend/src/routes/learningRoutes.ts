import { Router } from 'express';
import { YouTubeLearningAgent } from '../youtube_learning/youtubeLearningAgent.js';
import { WebLearningAgent } from '../web_learning/webLearningAgent.js';
import { MultimodalLearningAgent } from '../multimodal_learning/multimodalAgent.js';
import { GitHubLearningAgent } from '../github_learning/githubLearningAgent.js';
import { SelfModificationAgent } from '../self_modification/selfModificationAgent.js';
import { LearningStats } from '../learning/learning_stats.js';
import { readLearningArtifacts } from '../learning/learning_storage.js';
import { IntegrationManager } from '../self_modification/integrationManager.js';

const router = Router();
const youtubeAgent = new YouTubeLearningAgent();
const webAgent = new WebLearningAgent();
const multimodalAgent = new MultimodalLearningAgent();
const githubAgent = new GitHubLearningAgent();
const stats = new LearningStats();
const selfModificationAgent = new SelfModificationAgent();
const integrationManager = new IntegrationManager();

router.post('/learning/youtube', async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ detail: 'url is required' });
  const result = await youtubeAgent.run({ request: url });
  return res.json({ status: 'ok', summary: result.summary });
});

router.post('/learning/web', async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ detail: 'url is required' });
  const result = await webAgent.run({ request: url });
  return res.json({ status: 'ok', summary: result.summary });
});

router.post('/learning/multimodal', async (req, res) => {
  const payload = req.body?.payload;
  if (!payload || !payload.type || !payload.content) return res.status(400).json({ detail: 'payload type/content required' });
  const context = { multimodal: { type: String(payload.type), content: String(payload.content), title: payload.title } };
  const result = await multimodalAgent.run({ request: JSON.stringify(payload), context });
  return res.json({ status: 'ok', summary: result.summary });
});

router.post('/learning/github', async (req, res) => {
  const url = String(req.body?.repo_url || '').trim();
  if (!url) return res.status(400).json({ detail: 'repo_url is required' });
  const result = await githubAgent.run({ request: url });
  return res.json({ status: 'ok', summary: result.summary });
});

router.post('/agent/self-upgrade', async (req, res) => {
  const featureRequest = String(req.body?.feature_request || '').trim();
  if (!featureRequest) return res.status(400).json({ detail: 'feature_request is required' });
  const context = {
    reason: String(req.body?.reason || 'self upgrade requested by user').trim(),
    steps: Array.isArray(req.body?.steps) ? req.body.steps.map(String) : undefined,
    runTests: Boolean(req.body?.run_tests || req.body?.runTests),
  };
  const result = await selfModificationAgent.run({ request: featureRequest, context });
  return res.json({ status: 'ok', summary: result.summary });
});

router.get('/learning/stats', (_req, res) => {
  return res.json({ status: 'ok', stats: stats.read() });
});

router.get('/learning/github/stats', (_req, res) => {
  const artifacts = readLearningArtifacts('github_knowledge.json');
  const patternSet = new Set<string>();
  const architectureSet = new Set<string>();
  const repos = new Set<string>();
  for (const entry of artifacts) {
    const data = entry as Record<string, any>;
    const repoId = String(data.repo || '').trim();
    if (repoId) repos.add(repoId);
    (data.patterns || []).forEach((p: string) => patternSet.add(p));
    if (data.architecture) architectureSet.add(String(data.architecture));
  }
  return res.json({
    status: 'ok',
    stats: {
      repositories: repos.size,
      patterns: Array.from(patternSet),
      architectures: Array.from(architectureSet),
    },
  });
});

router.get('/evolution/upgrades', (_req, res) => {
  return res.json({ status: 'ok', upgrades: integrationManager.history() });
});

export function createLearningRouter(): Router {
  return router;
}
