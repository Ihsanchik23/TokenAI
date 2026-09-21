import Link from "next/link";
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

export default async function EditCoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const [staff, data, options] = await Promise.all([
    requireStaff(),
    getAdminCourse(id),
    getCourseOptions(),
  ]);

  return (
    <section className="stack roomy">
      {query.error === "delete-failed" && <p className="notice">Не удалось удалить курс. Проверьте права и попробуйте ещё раз.</p>}
      <div className="actions split">
        <div><p className="eyebrow">{data.course.status}</p><h2>{data.course.title}</h2></div>
        <div className="actions"><Link href={`/admin/courses/${id}/preview`}>Preview</Link><StatusButton courseId={id} status={data.course.status} /><form action={deleteCourseAction.bind(null, id)}><ConfirmButton message="Удалить весь курс, его модули и уроки? Это действие нельзя отменить.">Удалить курс</ConfirmButton></form></div>
      </div>
      <details open>
        <summary>Настройки курса</summary>
        <div className="details-body"><CourseEditor course={data.course} topicIds={data.topicIds} instructorIds={data.instructorIds} {...options} currentUserId={staff.id} /></div>
      </details>
      <section className="stack">
        <div><p className="eyebrow">Curriculum</p><h2>Модули и уроки</h2></div>
        {data.modules.map((module, moduleIndex) => (
          <article className="card stack" key={module.id}>
            <div className="actions split">
              <div><p className="eyebrow">Модуль {module.position}</p><h2>{module.title}</h2>{module.description && <p className="muted">{module.description}</p>}</div>
              <div className="actions">
                <form action={moveModuleAction.bind(null, id, module.id, "up")}><button className="icon-button" disabled={moduleIndex === 0} aria-label="Поднять модуль">↑</button></form>
                <form action={moveModuleAction.bind(null, id, module.id, "down")}><button className="icon-button" disabled={moduleIndex === data.modules.length - 1} aria-label="Опустить модуль">↓</button></form>
                <form action={deleteModuleAction.bind(null, id, module.id)}><ConfirmButton message="Удалить модуль и все его уроки? Это действие нельзя отменить.">Удалить</ConfirmButton></form>
              </div>
            </div>
            <ModuleForm courseId={id} module={module} />
            <div className="lesson-list">
              {module.lessons?.map((lesson, lessonIndex: number) => (
                <div className="lesson-row" key={lesson.id}>
                  <span className="lesson-kind">{lesson.lesson_type}</span>
                  <div><strong>{lesson.position}. {lesson.title}</strong><p className="muted">{lesson.is_preview ? "Preview · " : ""}{lesson.is_required ? "обязательный" : "необязательный"}</p></div>
                  <div className="actions">
                    <form action={moveLessonAction.bind(null, id, lesson.id, "up")}><button className="icon-button" disabled={lessonIndex === 0}>↑</button></form>
                    <form action={moveLessonAction.bind(null, id, lesson.id, "down")}><button className="icon-button" disabled={lessonIndex === module.lessons.length - 1}>↓</button></form>
                    <Link href={`/admin/courses/${id}/lessons/${lesson.id}/edit`}>Изменить</Link>
                    <form action={deleteLessonAction.bind(null, id, lesson.id)}><ConfirmButton message="Удалить этот урок? Это действие нельзя отменить.">Удалить</ConfirmButton></form>
                  </div>
                </div>
              ))}
            </div>
            <div className="actions">
              <Link className="button small secondary" href={`/admin/courses/${id}/lessons/new?module=${module.id}&type=theory`}>+ Теория</Link>
              <Link className="button small secondary" href={`/admin/courses/${id}/lessons/new?module=${module.id}&type=video`}>+ Видео</Link>
              <Link className="button small secondary" href={`/admin/courses/${id}/lessons/new?module=${module.id}&type=quiz`}>+ Тест</Link>
              <Link className="button small secondary" href={`/admin/courses/${id}/lessons/new?module=${module.id}&type=assignment`}>+ Задание</Link>
            </div>
          </article>
        ))}
        <div className="card"><ModuleForm courseId={id} /></div>
      </section>
    </section>
  );
}
