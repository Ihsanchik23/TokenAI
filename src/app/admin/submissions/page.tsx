import { ArrowUpRight, CheckCircle2, ClipboardCheck, FileText, Link2, RotateCcw, SlidersHorizontal, UserRound } from "lucide-react";
import { AdminSubmissionReview } from "@/components/admin-submission-review";
import { createClient } from "@/lib/supabase/server";

type SubmissionRow = {
  id: string;
  user_id: string;
  attempt_number: number;
  text_answer: string | null;
  link_url: string | null;
  status: "submitted" | "approved" | "needs_revision";
  teacher_comment: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  assignment: {
    id: string;
    lesson: {
      id: string;
      title: string;
      module: { course_id: string; course: { id: string; title: string; slug: string } };
    };
  };
  submission_files: { id: string; file_path: string; file_name: string; file_size: number }[];
};

const statusLabels = { submitted: "На проверке", approved: "Принято", needs_revision: "Нужна доработка" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<{ status?: string; course?: string; assignment?: string }> }) {
  const filters = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("assignment_submissions").select("id,user_id,attempt_number,text_answer,link_url,status,teacher_comment,submitted_at,reviewed_at,assignment:assignments!inner(id,lesson:lessons!inner(id,title,module:modules!inner(course_id,course:courses!inner(id,title,slug)))),submission_files(id,file_path,file_name,file_size)").order("submitted_at", { ascending: false }).limit(100);
  if (["submitted", "approved", "needs_revision"].includes(filters.status ?? "")) query = query.eq("status", filters.status as "submitted" | "approved" | "needs_revision");
  if (uuidPattern.test(filters.assignment ?? "")) query = query.eq("assignment_id", filters.assignment as string);
  const { data } = await query;
  const allRows = (data ?? []) as unknown as SubmissionRow[];
  const rows = uuidPattern.test(filters.course ?? "")
    ? allRows.filter((row) => row.assignment.lesson.module.course_id === filters.course)
    : allRows;
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id,display_name,username").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const courses = [...new Map(allRows.map((row) => [row.assignment.lesson.module.course.id, row.assignment.lesson.module.course])).values()];
  const assignments = [...new Map(allRows.map((row) => [row.assignment.id, { id: row.assignment.id, title: row.assignment.lesson.title }])).values()];
  const latestAttempt = new Map<string, number>();
  for (const row of allRows) {
    const key = `${row.assignment.id}:${row.user_id}`;
    latestAttempt.set(key, Math.max(latestAttempt.get(key) ?? 0, row.attempt_number));
  }

  const signedRows = await Promise.all(rows.map(async (row) => ({
    ...row,
    submission_files: await Promise.all(row.submission_files.map(async (file) => {
      const { data: signed } = await supabase.storage.from("submission-files").createSignedUrl(file.file_path, 3600);
      return { ...file, signedUrl: signed?.signedUrl ?? null };
    })),
  })));

  return <section className="studio-page submissions-page"><header className="studio-page-heading"><div><p className="eyebrow">Проверка работ</p><h1>Задания</h1><p>Очередь отправок по доступным вам курсам.</p></div><span className="studio-heading-count">{signedRows.length}</span></header><form className="studio-filter-bar submission-filter"><SlidersHorizontal aria-hidden="true" size={18} /><label><span className="visually-hidden">Статус</span><select name="status" defaultValue={filters.status ?? ""}><option value="">Все статусы</option><option value="submitted">На проверке</option><option value="approved">Принято</option><option value="needs_revision">Нужна доработка</option></select></label><label><span className="visually-hidden">Курс</span><select name="course" defaultValue={filters.course ?? ""}><option value="">Все курсы</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label><label><span className="visually-hidden">Задание</span><select name="assignment" defaultValue={filters.assignment ?? ""}><option value="">Все задания</option>{assignments.map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.title}</option>)}</select></label><button className="button secondary">Применить</button></form><div className="submission-queue">{signedRows.length ? signedRows.map((row) => { const profile = profileById.get(row.user_id); const course = row.assignment.lesson.module.course; const isLatest = latestAttempt.get(`${row.assignment.id}:${row.user_id}`) === row.attempt_number; const attemptCount = allRows.filter((attempt) => attempt.assignment.id === row.assignment.id && attempt.user_id === row.user_id).length; return <details className={`submission-review-row ${row.status}`} key={row.id}><summary><span className="submission-student"><UserRound aria-hidden="true" size={18} /><span><strong>{profile?.display_name || `@${profile?.username ?? row.user_id}`}</strong><small>{profile?.username ? `@${profile.username}` : "Студент"}</small></span></span><span><small>Курс</small><strong>{course.title}</strong></span><span><small>Задание</small><strong>{row.assignment.lesson.title}</strong></span><span><small>Попытка</small><strong>{row.attempt_number} из {attemptCount}</strong></span><time dateTime={row.submitted_at}>{new Date(row.submitted_at).toLocaleDateString("ru-RU")}</time><span className={`studio-status ${row.status}`}>{statusLabels[row.status]}</span></summary><div className="submission-review-body"><div className="submission-content"><h3>Материалы студента</h3>{row.text_answer && <div className="submission-answer"><FileText aria-hidden="true" size={18} /><p>{row.text_answer}</p></div>}{row.link_url && <a className="submission-resource" href={row.link_url} target="_blank" rel="noreferrer"><Link2 aria-hidden="true" size={17} />Открыть ссылку<ArrowUpRight aria-hidden="true" size={15} /></a>}{row.submission_files.map((file) => <a className="submission-resource" href={file.signedUrl ?? "#"} target="_blank" rel="noreferrer" key={file.id}><FileText aria-hidden="true" size={17} />{file.file_name}<small>{Math.max(1, Math.round(file.file_size / 1024))} КБ</small></a>)}{!row.text_answer && !row.link_url && !row.submission_files.length && <p className="studio-empty-inline">Материалы не приложены.</p>}{row.teacher_comment && <div className="review-history-comment">{row.status === "approved" ? <CheckCircle2 aria-hidden="true" size={18} /> : <RotateCcw aria-hidden="true" size={18} />}<p><strong>Комментарий преподавателя</strong><span>{row.teacher_comment}</span></p></div>}</div><aside className="submission-decision"><h3>Решение</h3>{row.status === "submitted" ? <AdminSubmissionReview submissionId={row.id} disabled={!isLatest} /> : <p>Эта попытка уже проверена.</p>}</aside></div></details>; }) : <div className="studio-empty"><ClipboardCheck aria-hidden="true" size={28} /><h2>Работ не найдено</h2><p>Измените фильтры или дождитесь новых отправок.</p></div>}</div></section>;
}
