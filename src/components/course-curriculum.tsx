import Link from "next/link";
import { BookOpen, ClipboardCheck, Eye, ListChecks, LockKeyhole, Play } from "lucide-react";

type Module = { id: string; title: string; description: string | null; position: number; lessons: { id: string; title: string; lesson_type: string; position: number; is_preview: boolean }[] };

export function CourseCurriculum({ modules, slug, admin = false, courseId }: { modules: Module[]; slug?: string; admin?: boolean; courseId?: string }) {
  const lessonLabels: Record<string, string> = { theory: "Теория", video: "Видео", quiz: "Тест", assignment: "Задание" };
  const lessonIcons = { theory: BookOpen, video: Play, quiz: ListChecks, assignment: ClipboardCheck };
  return (
    <div className="course-curriculum">
      {modules.map((module, index) => (
        <details key={module.id} open={index === 0}>
          <summary>
            <span className="curriculum-number">{String(module.position).padStart(2, "0")}</span>
            <span className="curriculum-summary-copy"><strong>{module.title}</strong><small>{module.lessons.length} {module.lessons.length === 1 ? "урок" : "уроков"}</small></span>
            <span className="curriculum-toggle" aria-hidden="true">+</span>
          </summary>
          <div className="curriculum-details">
            {module.description && <p className="muted">{module.description}</p>}
            <div className="lesson-list">
              {module.lessons.map((lesson) => {
                const Icon = lessonIcons[lesson.lesson_type as keyof typeof lessonIcons] ?? BookOpen;
                return (
                  <div className="lesson-row" key={lesson.id}>
                    <span className="lesson-type-icon"><Icon aria-hidden="true" size={17} /></span>
                    <span className="lesson-row-copy"><strong>{lesson.position}. {lesson.title}</strong><small>{lessonLabels[lesson.lesson_type] ?? lesson.lesson_type}</small></span>
                    {admin && courseId ? <Link href={`/admin/courses/${courseId}/lessons/${lesson.id}/edit`}>Открыть</Link> : lesson.is_preview && slug ? <Link className="preview-link" href={`/courses/${slug}/lessons/${lesson.id}`}><Eye aria-hidden="true" size={16} />Preview</Link> : <span className="locked-label"><LockKeyhole aria-hidden="true" size={15} />После зачисления</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
