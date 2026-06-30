export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface StreamChunk {
  type: "start" | "chunk" | "end" | "error";
  content?: string;
}

export interface Bookmark {
  id: string;
  conversation_id: string;
  message_id: string;
  content: string;
  note: string | null;
  created_at: string;
}

export interface QuizQuestion {
  question: string;
  type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface DailyPlan {
  day: number;
  topic: string;
  key_concepts: string[];
  estimated_time_minutes: number;
  practice_tasks: string[];
  completed: boolean;
}

export interface StudyPlan {
  title: string;
  total_days: number;
  daily_plans: DailyPlan[];
}
