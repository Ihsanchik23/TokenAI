import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPublicCourse } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";

function MarkdownText({ value }: { value: string }) {
  return <div className="lesson-content">{value.split(/\n{2,}/).map((block, index) => block.startsWith("# ") ? <h2 key={index}>{block.slice(2)}</h2> : <p key={index}>{block}</p>)}</div>;
}

export default async function PreviewLessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params; const courseData = await getPublicCourse(slug);
  const lesson = courseData.modules.flatMap((module) => module.lessons).find((item) => item.id === lessonId && item.is_preview);
  if (!lesson) notFound();
  const supabase = await createClient(); let content: React.ReactNode = <p className="muted">Для этого типа урока доступен только preview программы.</p>;
  if (lesson.lesson_type === "theory") { const { data } = await supabase.from("lesson_theory").select("content_json").eq("lesson_id", lessonId).maybeSingle(); content = <MarkdownText value={(data?.content_json as { content?: string } | null)?.content ?? ""} />; }
  if (lesson.lesson_type === "video") { const { data } = await supabase.from("lesson_videos").select("video_id").eq("lesson_id", lessonId).maybeSingle(); if (data?.video_id) content = <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${data.video_id}`} title={lesson.title} allowFullScreen /></div>; }
  return <main className="page-shell preview-lesson-page"><Link className="player-back-link" href={`/courses/${slug}`}><ArrowLeft aria-hidden="true" size={17} />Назад к курсу</Link><header className="lesson-heading"><p className="eyebrow">Бесплатный preview</p><h1>{lesson.title}</h1></header><article className="lesson-stage">{content}</article></main>;
}
