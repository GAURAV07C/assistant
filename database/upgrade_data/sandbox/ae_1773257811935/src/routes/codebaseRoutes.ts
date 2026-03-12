import { Router } from 'express';
import { CodeAwarenessAgent } from '../code_awareness/codeAwarenessAgent.js';
import { CodeKnowledgeStore } from '../code_awareness/codeKnowledgeStore.js';

const router = Router();
const awarenessAgent = new CodeAwarenessAgent();
const knowledgeStore = new CodeKnowledgeStore();

router.get('/codebase/map', async (_req, res) => {
  let snapshot = knowledgeStore.read();
  if (!snapshot) snapshot = await awarenessAgent.refresh();
  return res.json({ status: 'ok', map: snapshot });
});

router.get('/codebase/features', (_req, res) => {
  return res.json({ status: 'ok', features: knowledgeStore.features() });
});

router.get('/codebase/search', (req, res) => {
  const query = String(req.query?.q || '').trim();
  if (!query) return res.status(400).json({ detail: 'Query parameter q is required' });
  return res.json({ status: 'ok', query, results: knowledgeStore.search(query) });
});

router.post('/codebase/refresh', async (_req, res) => {
  const snapshot = await awarenessAgent.refresh();
  return res.json({ status: 'ok', summary: 'Code awareness refreshed', scanned_at: snapshot.scanned_at });
});

export function createCodebaseRouter() {
  return router;
}
