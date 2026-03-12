import { Router } from 'express';
import { ArchitectureEvolutionAgent } from '../architecture_evolution/architectureEvolutionAgent.js';
import { RefactorPlanner } from '../architecture_evolution/refactorPlanner.js';

const router = Router();
const agent = new ArchitectureEvolutionAgent();
const planner = new RefactorPlanner();

router.post('/agent/architecture/refactor', async (req, res) => {
  const detail = String(req.body?.detail || 'analyze current architecture');
  const result = await agent.run({ request: detail, context: req.body });
  return res.json({ status: 'ok', summary: result.summary });
});

router.get('/architecture/proposals', (_req, res) => {
  const proposals = planner.latest() ? [planner.latest()] : [];
  return res.json({ status: 'ok', proposals });
});

export function createArchitectureRouter() {
  return router;
}
