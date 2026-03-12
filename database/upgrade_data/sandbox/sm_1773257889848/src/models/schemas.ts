import { z } from 'zod';
import { MAX_MESSAGE_LENGTH } from '../config.js';

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  shared_session: z.boolean().optional().default(true),
  session_id: z.string().optional().nullable(),
  tts: z.boolean().optional().default(false),
});

export const TTSRequestSchema = z.object({
  text: z.string().min(1).max(5000),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type TTSRequest = z.infer<typeof TTSRequestSchema>;
