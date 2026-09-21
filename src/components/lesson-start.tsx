"use client";

import { useEffect, useRef } from "react";
import { startLessonAction } from "@/app/learning/actions";

export function LessonStart({ lessonId }: { lessonId: string }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void startLessonAction(lessonId);
  }, [lessonId]);
  return null;
}
