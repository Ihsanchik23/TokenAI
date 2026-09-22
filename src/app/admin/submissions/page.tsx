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

  return <section className="stack roomy"><div><p className="eyebrow">Проверка работ</p><h2>Отправленные задания</h2><p className="muted">Доступны только работы ваших курсов.</p></div><form className="card filter-row assignment-filters"><select name="status" defaultValue={filters.status ?? ""}><option value="">Все статусы</option><option value="submitted">На проверке</option><option value="approved">Принято</option><option value="needs_revision">Нужна доработка</option></select><select name="course" defaultValue={filters.course ?? ""}><option value="">Все курсы</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select><select name="assignment" defaultValue={filters.assignment ?? ""}><option value="">Все задания</option>{assignments.map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.title}</option>)}</select><button className="button secondary">Применить</button></form><div className="stack">{signedRows.length ? signedRows.map((row) => { const profile = profileById.get(row.user_id); const course = row.assignment.lesson.module.course; const isLatest = latestAttempt.get(`${row.assignment.id}:${row.user_id}`) === row.attempt_number; return <article className="card stack" key={row.id}><div className="actions split"><div><p className="eyebrow">{course.title}</p><h3>{row.assignment.lesson.title} · попытка {row.attempt_number}</h3><p className="muted">{profile?.display_name || `@${profile?.username ?? row.user_id}`} · {new Date(row.submitted_at).toLocaleString("ru-RU")}</p></div><span className={`badge ${row.status}`}>{statusLabels[row.status]}</span></div>{row.text_answer && <p>{row.text_answer}</p>}{row.link_url && <a href={row.link_url} target="_blank" rel="noreferrer">Открыть ссылку ↗</a>}{row.submission_files.map((file) => <a href={file.signedUrl ?? "#"} target="_blank" rel="noreferrer" key={file.id}>{file.file_name}</a>)}{row.teacher_comment && <p className="notice"><strong>Комментарий:</strong> {row.teacher_comment}</p>}{row.status === "submitted" && <AdminSubmissionReview submissionId={row.id} disabled={!isLatest} />}</article>; }) : <div className="card center stack"><h3>Работ не найдено</h3><p className="muted">Измените фильтры или дождитесь новых отправок.</p></div>}</div></section>;
}
