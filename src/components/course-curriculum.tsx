import Link from "next/link";

type Module = { id: string; title: string; description: string | null; position: number; lessons: { id: string; title: string; lesson_type: string; position: number; is_preview: boolean }[] };

export function CourseCurriculum({ modules, slug, admin = false, courseId }: { modules: Module[]; slug?: string; admin?: boolean; courseId?: string }) {
  return <div className="stack">{modules.map((module) => <article className="card stack compact" key={module.id}><p className="eyebrow">Модуль {module.position}</p><h2>{module.title}</h2>{module.description && <p className="muted">{module.description}</p>}<div className="lesson-list">{module.lessons.map((lesson) => <div className="lesson-row" key={lesson.id}><span className="lesson-kind">{lesson.lesson_type}</span><span>{lesson.position}. {lesson.title}</span>{admin && courseId ? <Link href={`/admin/courses/${courseId}/lessons/${lesson.id}/edit`}>Открыть</Link> : lesson.is_preview && slug ? <Link href={`/courses/${slug}/lessons/${lesson.id}`}>Preview</Link> : <span className="muted">{lesson.is_preview ? "Preview" : "Закрыто"}</span>}</div>)}</div></article>)}</div>;
}
