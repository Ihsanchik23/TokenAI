import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, ClipboardList, Eye, FileQuestion, Pencil, Plus, Trash2, Video } from "lucide-react";
import {
  deleteLessonAction,
  deleteCourseAction,
  deleteModuleAction,
  moveLessonAction,
  moveModuleAction,
} from "@/app/admin/courses/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { CourseEditor } from "@/components/course-editor";
import { ModuleForm } from "@/components/module-form";
import { StatusButton } from "@/components/status-button";
import { requireStaff } from "@/lib/auth";
import { getAdminCourse, getCourseOptions } from "@/lib/courses";

const statusLabels = { draft: "Черновик", published: "Опубликован", archived: "В архиве" } as const;
const lessonLabels = { theory: "Теория", video: "Видео", quiz: "Тест", assignment: "Задание" } as const;
const lessonIcons = { theory: BookOpen, video: Video, quiz: FileQuestion, assignment: ClipboardList } as const;

export default async function EditCoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const [staff, data, options] = await Promise.all([
    requireStaff(),
    getAdminCourse(id),
    getCourseOptions(),
  ]);

  return (
    <section className="studio-page course-builder-page">
      {query.error === "delete-failed" && <p className="notice">Не удалось удалить курс. Проверьте права и попробуйте ещё раз.</p>}
      <Link className="studio-back-link" href="/admin/courses"><ArrowLeft aria-hidden="true" size={17} />Все курсы</Link>
      <header className="course-builder-heading"><div><span className={`studio-status ${data.course.status}`}>{statusLabels[data.course.status]}</span><h1>{data.course.title}</h1><p>Настройки, программа и публикация курса.</p></div><div className="course-builder-actions"><Link className="button secondary" href={`/admin/courses/${id}/preview`}><Eye aria-hidden="true" size={18} />Предпросмотр</Link><StatusButton courseId={id} status={data.course.status} /></div></header>
      <CourseEditor course={data.course} topicIds={data.topicIds} instructorIds={data.instructorIds} {...options} currentUserId={staff.id} />
      <section className="curriculum-builder" id="course-program">
        <div className="studio-section-heading"><div><p className="eyebrow">Программа</p><h2>Модули и уроки</h2><p>Порядок определяет последовательность обучения.</p></div><span>{data.modules.reduce((total, module) => total + (module.lessons?.length ?? 0), 0)} уроков</span></div>
        {data.modules.map((module, moduleIndex) => (
          <article className="curriculum-module" key={module.id}>
            <div className="curriculum-module-heading">
              <span className="module-index">{String(module.position).padStart(2, "0")}</span>
              <div><h3>{module.title}</h3>{module.description && <p>{module.description}</p>}</div>
              <div className="compact-icon-actions"><form action={moveModuleAction.bind(null, id, module.id, "up")}><button className="icon-button" disabled={moduleIndex === 0} aria-label="Поднять модуль"><ArrowUp aria-hidden="true" size={16} /></button></form><form action={moveModuleAction.bind(null, id, module.id, "down")}><button className="icon-button" disabled={moduleIndex === data.modules.length - 1} aria-label="Опустить модуль"><ArrowDown aria-hidden="true" size={16} /></button></form><form action={deleteModuleAction.bind(null, id, module.id)}><ConfirmButton message="Удалить модуль и все его уроки? Это действие нельзя отменить."><Trash2 aria-hidden="true" size={16} /><span className="visually-hidden">Удалить модуль</span></ConfirmButton></form></div>
            </div>
            <details className="module-settings"><summary>Настройки модуля</summary><ModuleForm courseId={id} module={module} /></details>
            <div className="studio-lesson-list">{module.lessons?.length ? module.lessons.map((lesson, lessonIndex: number) => { const kind = lesson.lesson_type as keyof typeof lessonIcons; const LessonIcon = lessonIcons[kind] ?? BookOpen; return <div className="studio-lesson-row" key={lesson.id}><span className="lesson-type-icon"><LessonIcon aria-hidden="true" size={18} /></span><div className="studio-lesson-copy"><strong>{lesson.position}. {lesson.title}</strong><span><span>{lessonLabels[kind] ?? lesson.lesson_type}</span><span>{lesson.is_required ? "Обязательный" : "Необязательный"}</span>{lesson.is_preview && <span>Preview</span>}</span></div><div className="compact-icon-actions"><form action={moveLessonAction.bind(null, id, lesson.id, "up")}><button className="icon-button" disabled={lessonIndex === 0} aria-label={`Поднять урок «${lesson.title}»`}><ArrowUp aria-hidden="true" size={15} /></button></form><form action={moveLessonAction.bind(null, id, lesson.id, "down")}><button className="icon-button" disabled={lessonIndex === module.lessons.length - 1} aria-label={`Опустить урок «${lesson.title}»`}><ArrowDown aria-hidden="true" size={15} /></button></form><Link className="icon-button" href={`/admin/courses/${id}/lessons/${lesson.id}/edit`} aria-label={`Изменить урок «${lesson.title}»`}><Pencil aria-hidden="true" size={15} /></Link><form action={deleteLessonAction.bind(null, id, lesson.id)}><ConfirmButton message="Удалить этот урок? Это действие нельзя отменить."><Trash2 aria-hidden="true" size={15} /><span className="visually-hidden">Удалить урок</span></ConfirmButton></form></div></div>; }) : <p className="module-empty">В модуле пока нет уроков.</p>}</div>
            <div className="add-lesson-actions"><span>Добавить урок</span><Link href={`/admin/courses/${id}/lessons/new?module=${module.id}&type=theory`}><BookOpen aria-hidden="true" size={16} />Теория</Link><Link href={`/admin/courses/${id}/lessons/new?module=${module.id}&type=video`}><Video aria-hidden="true" size={16} />Видео</Link><Link href={`/admin/courses/${id}/lessons/new?module=${module.id}&type=quiz`}><FileQuestion aria-hidden="true" size={16} />Тест</Link><Link href={`/admin/courses/${id}/lessons/new?module=${module.id}&type=assignment`}><ClipboardList aria-hidden="true" size={16} />Задание</Link></div>
          </article>
        ))}
        <div className="new-module"><div><Plus aria-hidden="true" size={20} /><span><strong>Новый модуль</strong><small>Добавится в конец программы</small></span></div><ModuleForm courseId={id} /></div>
      </section>
      <footer className="course-danger-zone"><div><strong>Удаление курса</strong><p>Курс, его модули и уроки будут удалены без возможности восстановления.</p></div><form action={deleteCourseAction.bind(null, id)}><ConfirmButton message="Удалить весь курс, его модули и уроки? Это действие нельзя отменить.">Удалить курс</ConfirmButton></form></footer>
    </section>
  );
}
