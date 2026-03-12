export interface MicroTrainingPlan {
  model_type: 'coding_micro_model' | 'reasoning_micro_model' | 'knowledge_micro_model' | 'user_style_model' | 'research_model';
  dataset_file: string;
  strategy: 'lora_preparation' | 'small_model_finetune_preparation' | 'retrieval_adapter_preparation';
  status: 'prepared';
  note: string;
}

export class MicroModelTrainer {
  preparePlans(datasetFile: string): MicroTrainingPlan[] {
    const target = String(datasetFile || '').trim();
    return [
      {
        model_type: 'coding_micro_model',
        dataset_file: target,
        strategy: 'lora_preparation',
        status: 'prepared',
        note: 'Dataset prepared only. No large-model training executed.',
      },
      {
        model_type: 'reasoning_micro_model',
        dataset_file: target,
        strategy: 'small_model_finetune_preparation',
        status: 'prepared',
        note: 'Reasoning dataset ready for future offline training pipeline.',
      },
      {
        model_type: 'knowledge_micro_model',
        dataset_file: target,
        strategy: 'retrieval_adapter_preparation',
        status: 'prepared',
        note: 'Knowledge retrieval specialization dataset prepared.',
      },
    ];
  }
}
