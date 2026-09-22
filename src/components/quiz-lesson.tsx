"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, History, RotateCcw } from "lucide-react";
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

  return <div className="quiz-shell">
    <header className="quiz-intro">
      <div><p className="eyebrow">Проверка знаний</p><h2>{data.questionCount} вопросов</h2><p className="muted">Ответьте на каждый вопрос. Каждый вопрос имеет одинаковый вес.</p></div>
      <span className="attempt-count">{data.maxAttempts === null ? "Попытки без ограничений" : `Осталось попыток: ${data.remainingAttempts}`}</span>
    </header>

    {latestResult && <div className="quiz-result" role="status"><CheckCircle2 aria-hidden="true" size={28} /><div><p>Попытка {latestResult.attemptNumber} завершена</p><strong>{latestResult.percentage}%</strong><span>{latestResult.score} из {data.questionCount} правильных ответов</span></div></div>}
    {message && <p className={latestResult ? "notice success" : "notice"} aria-live="polite">{message}</p>}

    {activeAttempt ? <form className="quiz-form" action={submitAttempt}>
      <p className="quiz-attempt-label">Попытка {activeAttempt.attemptNumber}</p>
      {data.questions.map((question, index) => <fieldset className="quiz-question" key={question.id} disabled={pending}>
        <legend><span>{String(index + 1).padStart(2, "0")}</span><strong>{question.question}</strong></legend>
        <p className="field-help">{question.questionType === "multiple" ? "Можно выбрать несколько вариантов" : "Выберите один вариант"}</p>
        <div className="quiz-options">
        {question.options.map((option) => {
          const multiple = question.questionType === "multiple";
          const selected = (answers[question.id] ?? []).includes(option.id);
          return <label className={`quiz-option${selected ? " selected" : ""}`} key={option.id}>
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
        </div>
      </fieldset>)}
      <button className="button quiz-submit" disabled={pending}>{pending ? "Проверяем…" : "Завершить и проверить"}</button>
    </form> : <div className="quiz-start">
      {canStart ? <button className="button" type="button" disabled={pending} onClick={startAttempt}>{data.attempts.length ? <RotateCcw aria-hidden="true" size={18} /> : <CheckCircle2 aria-hidden="true" size={18} />}{pending ? "Начинаем…" : data.attempts.length ? "Пройти ещё раз" : "Начать тест"}</button> : <p className="notice">Доступные попытки закончились.</p>}
    </div>}

    {data.attempts.some((attempt) => attempt.completedAt) && <section className="quiz-history"><h3><History aria-hidden="true" size={19} />История попыток</h3>{data.attempts.filter((attempt) => attempt.completedAt).map((attempt) => <div className="quiz-history-row" key={attempt.id}><span>Попытка {attempt.attemptNumber}</span><strong>{attempt.score}/{data.questionCount} · {Number(attempt.percentage)}%</strong></div>)}</section>}
  </div>;
}
