export interface Question {
  id: string;
  question: string;
  answer?: string;
  readingTime: number;
  answerTime: number;
  category?: string;
  createdAt: string;
}

export interface SessionQuestion {
  questionId: string;
  questionText: string;
  answer?: string;
  readingTime: number;
  answerTime: number;
  videoFile: string;
  recordingDuration: number;
}

export interface SessionMetadata {
  sessionId: string;
  sessionName: string;
  createdAt: string;
  completed: boolean;
  totalQuestions: number;
  durationSeconds: number;
  questions: SessionQuestion[];
  config?: {
    mode: "sequential" | "random";
    count: number | "all";
    rangeStart?: number;
    rangeEnd?: number;
  };
}
