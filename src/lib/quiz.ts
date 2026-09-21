export type QuizOption = {
  id: string;
  text: string;
  position: number;
};

export type QuizQuestion = {
  id: string;
  question: string;
  questionType: "single" | "multiple" | "boolean";
  position: number;
  options: QuizOption[];
};

export type QuizAttemptSummary = {
  id: string;
  attemptNumber: number;
  score: number | null;
  percentage: number | null;
  startedAt: string;
  completedAt: string | null;
};

export type QuizLessonData = {
  quizId: string;
  maxAttempts: number | null;
  questionCount: number;
  configurationValid: boolean;
  questions: QuizQuestion[];
  attempts: QuizAttemptSummary[];
  activeAttemptId: string | null;
  remainingAttempts: number | null;
};

export type QuizAnswer = {
  questionId: string;
  optionIds: string[];
};
