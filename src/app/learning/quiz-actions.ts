"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { QuizAnswer } from "@/lib/quiz";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type QuizActionResult = {
  ok: boolean;
  message: string;
  result?: { attemptNumber: number; score: number; percentage: number };
};

function quizErrorMessage(code?: string): string {
  if (code === "42501") return "Тест сейчас недоступен или доступ к курсу истёк.";
  if (code === "22023") return "Тест настроен некорректно или ответы не прошли проверку.";
  if (code === "P0001") return "Доступные попытки закончились.";
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}

export async function startQuizAttemptAction(lessonId: string): Promise<QuizActionResult> {
  await requireUser();
  if (!uuidPattern.test(lessonId)) return { ok: false, message: "Некорректный тест." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_quiz_attempt", { target_lesson_id: lessonId });
  if (error) return { ok: false, message: quizErrorMessage(error.code) };
  revalidatePath("/my-courses");
  return { ok: true, message: "Попытка начата." };
}

export async function submitQuizAttemptAction(
  attemptId: string,
  answers: QuizAnswer[],
): Promise<QuizActionResult> {
  await requireUser();
  if (!uuidPattern.test(attemptId) || !Array.isArray(answers) || answers.length > 200) {
    return { ok: false, message: "Некорректные ответы." };
  }
  const validShape = answers.every((answer) =>
    uuidPattern.test(answer.questionId)
    && Array.isArray(answer.optionIds)
    && answer.optionIds.length > 0
    && answer.optionIds.length <= 50
    && answer.optionIds.every((optionId) => uuidPattern.test(optionId)),
  );
  if (!validShape) return { ok: false, message: "Ответьте на каждый вопрос." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    target_attempt_id: attemptId,
    submitted_answers: answers,
  });
  if (error) return { ok: false, message: quizErrorMessage(error.code) };
  const result = data as { attemptNumber?: number; score?: number; percentage?: number } | null;
  revalidatePath("/my-courses");
  return {
    ok: true,
    message: "Ответы приняты. Урок завершён.",
    result: {
      attemptNumber: Number(result?.attemptNumber ?? 0),
      score: Number(result?.score ?? 0),
      percentage: Number(result?.percentage ?? 0),
    },
  };
}
