export interface EvaluationInput {
  request: string;
  response: string;
  steps_executed: number;
  had_failure: boolean;
}

export interface EvaluationResult {
  response_quality: number;
  reasoning_quality: number;
  task_success: number;
  coding_accuracy: number;
  bug_fix_success_rate: number;
  final_score: number;
}

export class ResponseEvaluator {
  evaluate(input: EvaluationInput): EvaluationResult {
    const req = String(input.request || '');
    const res = String(input.response || '');

    const responseQuality = Math.max(0, Math.min(100, Math.round(40 + Math.min(35, res.length / 45) + (input.had_failure ? -20 : 10))));
    const reasoningQuality = /\b(assumption|tradeoff|because|step|next)\b/i.test(res) ? 82 : 64;
    const taskSuccess = input.had_failure ? 35 : Math.min(100, 55 + input.steps_executed * 9);
    const codingAccuracy = /\b(code|function|api|bug|fix|refactor|test)\b/i.test(`${req}\n${res}`) ? 80 : 65;
    const bugFixRate = /\bfix|bug|error\b/i.test(req) ? (input.had_failure ? 40 : 78) : 70;

    const finalScore = Math.round((responseQuality + reasoningQuality + taskSuccess + codingAccuracy + bugFixRate) / 5);

    return {
      response_quality: responseQuality,
      reasoning_quality: reasoningQuality,
      task_success: taskSuccess,
      coding_accuracy: codingAccuracy,
      bug_fix_success_rate: bugFixRate,
      final_score: finalScore,
    };
  }
}
