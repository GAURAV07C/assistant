export type Role = 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatHistory {
  session_id: string;
  messages: ChatMessage[];
}

export interface SearchResultItem {
  title: string;
  content: string;
  url: string;
  score: number;
}

export interface SearchPayload {
  query: string;
  answer: string;
  results: SearchResultItem[];
}
