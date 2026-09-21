import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Course = {
  id: string; slug: string; title: string; short_description: string | null;
  description: string | null; cover_path: string | null; status: "draft" | "published" | "archived";
  access_type: "free" | "paid" | "private"; price_amount: number | null;
  currency: string | null; level: "beginner" | "intermediate" | "advanced";
  estimated_minutes: number | null; created_at: string; updated_at: string;
};

export type Topic = { id: string; name: string; slug: string };
export type Instructor = { id: string; display_name: string | null; username: string; role: string };

export async function getCourseOptions() {
  const supabase = await createClient();
  const [{ data: topics }, { data: instructors }] = await Promise.all([
    supabase.from("topics").select("id,name,slug").order("name"),
    supabase.from("profiles").select("id,display_name,username,role").in("role", ["admin", "instructor"]).order("display_name"),
  ]);
  return { topics: (topics ?? []) as Topic[], instructors: (instructors ?? []) as Instructor[] };
}

export async function getAdminCourse(id: string) {
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course) notFound();
  const [{ data: topicRows }, { data: instructorRows }, { data: modules }] = await Promise.all([
    supabase.from("course_topics").select("topic_id").eq("course_id", id),
    supabase.from("course_instructors").select("user_id").eq("course_id", id),
    supabase.from("modules").select("id,title,description,position,lessons(id,title,description,lesson_type,position,is_required,is_preview)").eq("course_id", id).order("position").order("position", { referencedTable: "lessons" }),
  ]);
  return {
    course: course as Course,
    topicIds: (topicRows ?? []).map((row) => row.topic_id as string),
    instructorIds: (instructorRows ?? []).map((row) => row.user_id as string),
    modules: modules ?? [],
  };
}

export async function getPublicCourse(slug: string) {
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!course) notFound();
  const [{ data: topicRows }, { data: instructorRows }, { data: modules }] = await Promise.all([
    supabase.from("course_topics").select("topics(id,name,slug)").eq("course_id", course.id),
    supabase.from("course_instructors").select("profiles(id,display_name,username)").eq("course_id", course.id),
    supabase.from("modules").select("id,title,description,position,lessons(id,title,description,lesson_type,position,is_required,is_preview)").eq("course_id", course.id).order("position").order("position", { referencedTable: "lessons" }),
  ]);
  return { course: course as Course, topics: topicRows ?? [], instructors: instructorRows ?? [], modules: modules ?? [] };
}
