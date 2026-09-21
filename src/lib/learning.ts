import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LearningLesson = {
  id: string;
  moduleId: string;
  modulePosition: number;
  title: string;
  description: string | null;
  lesson_type: "theory" | "video" | "quiz" | "assignment";
  position: number;
  is_required: boolean;
  state: "locked" | "available" | "completed";
  progressPercent: number;
  progressStatus: "available" | "in_progress" | "completed" | null;
  lastVideoPosition: number;
  updatedAt: string | null;
};

export type LearningModule = {
  id: string;
  title: string;
  position: number;
  lessons: LearningLesson[];
};

export async function getLearningState(courseSlug: string, userId: string) {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id,slug,title,description,status")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!course) return null;

  const [{ data: enrollment }, { data: isCourseStaff }, { data: modules }] = await Promise.all([
    supabase.from("enrollments").select("id,status,started_at,expires_at").eq("user_id", userId).eq("course_id", course.id).in("status", ["active", "completed"]).maybeSingle(),
    supabase.rpc("is_course_staff", { target_course_id: course.id }),
    supabase.from("modules").select("id,title,position,lessons(id,title,description,lesson_type,position,is_required,is_preview)").eq("course_id", course.id).order("position").order("position", { referencedTable: "lessons" }),
  ]);
  const expired = Boolean(enrollment?.expires_at && new Date(enrollment.expires_at) <= new Date());
  const staff = Boolean(isCourseStaff);
  if ((!enrollment || expired) && !staff) return null;

  const { data: progressRows } = enrollment
    ? await supabase.from("lesson_progress").select("lesson_id,status,progress_percent,last_video_position,updated_at").eq("enrollment_id", enrollment.id)
    : { data: [] };
  const progressByLesson = new Map((progressRows ?? []).map((row) => [row.lesson_id, row]));
  let requiredBlocked = false;
  const learningModules: LearningModule[] = (modules ?? []).map((courseModule) => ({
    id: courseModule.id,
    title: courseModule.title,
    position: courseModule.position,
    lessons: courseModule.lessons.map((lesson) => {
      const progress = progressByLesson.get(lesson.id);
      const completed = progress?.status === "completed";
      const available = staff || completed || !requiredBlocked;
      const result: LearningLesson = {
        id: lesson.id,
        moduleId: courseModule.id,
        modulePosition: courseModule.position,
        title: lesson.title,
        description: lesson.description,
        lesson_type: lesson.lesson_type,
        position: lesson.position,
        is_required: lesson.is_required,
        state: completed ? "completed" : available ? "available" : "locked",
        progressPercent: Number(progress?.progress_percent ?? 0),
        progressStatus: progress?.status ?? null,
        lastVideoPosition: Number(progress?.last_video_position ?? 0),
        updatedAt: progress?.updated_at ?? null,
      };
      if (lesson.is_required && !completed && !staff) requiredBlocked = true;
      return result;
    }),
  }));
  const lessons = learningModules.flatMap((courseModule) => courseModule.lessons);
  const requiredLessons = lessons.filter((lesson) => lesson.is_required);
  const completedRequired = requiredLessons.filter((lesson) => lesson.state === "completed").length;
  const learningComplete = requiredLessons.length > 0 && completedRequired === requiredLessons.length;
  const activeIncomplete = lessons
    .filter((lesson) => lesson.state === "available" && lesson.progressStatus === "in_progress")
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
  const continueLesson = learningComplete
    ? null
    : activeIncomplete ?? lessons.find((lesson) => lesson.state === "available") ?? null;

  return {
    course,
    enrollment: expired ? null : enrollment,
    staff,
    modules: learningModules,
    lessons,
    requiredTotal: requiredLessons.length,
    completedRequired,
    progressPercent: requiredLessons.length ? Math.round((completedRequired / requiredLessons.length) * 100) : 0,
    learningComplete,
    continueLesson,
  };
}
