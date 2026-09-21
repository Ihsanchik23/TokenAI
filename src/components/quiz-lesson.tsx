"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startQuizAttemptAction, submitQuizAttemptAction } from "@/app/learning/quiz-actions";
import type { QuizAnswer, QuizLessonData } from "@/lib/quiz";

export function QuizLesson({ lessonId, data }: { lessonId: string; data: QuizLessonData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<{ attemptNumber: number; score: number; percentage: number } | null>(null);
  const activeAttempt = data.attempts.find((attempt) => attempt.id === data.activeAttemptId) ?? null;
  const canStart = data.configurationValid && !data.activeAttemptId && (data.remainingAttempts === null || data.remainingAttempts > 0);

  function selectOption(questionId: string, optionId: string, multiple: boolean, checked: boolean) {
    setAnswers((current) => {
      if (!multiple) return { ...current, [questionId]: [optionId] };
      const selected = current[questionId] ?? [];
      return {
        ...current,
        [questionId]: checked ? [...selected, optionId] : selected.filter((id) => id !== optionId),
      };
    });
  }

  function startAttempt() {
    setMessage(null);
    startTransition(async () => {
      const result = await startQuizAttemptAction(lessonId);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function submitAttempt() {
    if (!data.activeAttemptId) return;
    const submitted: QuizAnswer[] = data.questions.map((question) => ({
      questionId: question.id,
      optionIds: answers[question.id] ?? [],
    }));
    if (submitted.some((answer) => answer.optionIds.length === 0)) {
      setMessage("Ответьте на каждый вопрос перед отправкой.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const response = await submitQuizAttemptAction(data.activeAttemptId as string, submitted);
      setMessage(response.message);
      if (response.ok && response.result) {
        setLatestResult(response.result);
        router.refresh();
      }
    });
  }

  if (!data.configurationValid) {
    return <p className="notice">Тест пока недоступен: администратору нужно проверить вопросы и варианты ответов.</p>;
  }

  return <div className="stack roomy">
    <header className="actions split">
      <div><strong>{data.questionCount} вопросов</strong><p className="field-help">Каждый вопрос имеет одинаковый вес.</p></div>
      <span className="badge">{data.maxAttempts === null ? "Попытки без ограничений" : `Осталось новых попыток: ${data.remainingAttempts}`}</span>
    </header>

    {latestResult && <p className="notice success">Попытка {latestResult.attemptNumber}: {latestResult.score}/{data.questionCount} — {latestResult.percentage}%.</p>}
    {message && <p className={latestResult ? "notice success" : "notice"} aria-live="polite">{message}</p>}

    {activeAttempt ? <form className="stack roomy" action={submitAttempt}>
      <p className="eyebrow">Попытка {activeAttempt.attemptNumber}</p>
      {data.questions.map((question, index) => <fieldset className="quiz-question stack compact" key={question.id} disabled={pending}>
        <legend><strong>{index + 1}. {question.question}</strong></legend>
        {question.options.map((option) => {
          const multiple = question.questionType === "multiple";
          return <label className="quiz-option" key={option.id}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={`question-${question.id}`}
              value={option.id}
              checked={(answers[question.id] ?? []).includes(option.id)}
              onChange={(event) => selectOption(question.id, option.id, multiple, event.target.checked)}
            />
            <span>{option.text}</span>
          </label>;
        })}
      </fieldset>)}
      <button className="button" disabled={pending}>{pending ? "Проверяем…" : "Завершить попытку"}</button>
    </form> : <div className="stack compact">
      {canStart ? <button className="button" type="button" disabled={pending} onClick={startAttempt}>{pending ? "Начинаем…" : data.attempts.length ? "Повторить тест" : "Начать тест"}</button> : <p className="notice">Доступные попытки закончились.</p>}
    </div>}

    {data.attempts.some((attempt) => attempt.completedAt) && <section className="stack compact"><h3>История попыток</h3>{data.attempts.filter((attempt) => attempt.completedAt).map((attempt) => <div className="order-summary" key={attempt.id}><span>Попытка {attempt.attemptNumber}</span><strong>{attempt.score}/{data.questionCount} · {Number(attempt.percentage)}%</strong></div>)}</section>}
  </div>;
}
