import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicTopic = { id: string; name: string; slug: string };

export type ShowcaseAuthor = {
  displayName: string | null;
  username: string;
  avatarPath: string | null;
};

export type ShowcaseCourse = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "archived";
  lessonTitle?: string;
};

export type ShowcaseWork = {
  id: string;
  title: string;
  description: string | null;
  coverPath: string | null;
  coverUrl?: string | null;
  externalUrl?: string | null;
  publishedAt: string;
  topic: PublicTopic;
  author: ShowcaseAuthor | null;
  relatedCourse: ShowcaseCourse | null;
};

export type PublicStudent = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
  topics: PublicTopic[];
  completedCourseCount: number;
  publishedWorkCount: number;
};

export type PublicStudentProfile = Omit<PublicStudent, "completedCourseCount" | "publishedWorkCount"> & {
  completedCourses: Array<{
    id: string;
    slug: string;
    title: string;
    status: "draft" | "published" | "archived";
    completedAt: string;
  }>;
  certificates: Array<{ id: string; code: string; issuedAt: string; courseTitle: string }>;
  publishedWorks: Array<{
    id: string;
    title: string;
    description: string | null;
    coverPath: string | null;
    publishedAt: string;
    topic: PublicTopic;
  }>;
};

export async function getShowcaseCoverUrls(
  supabase: SupabaseClient,
  paths: Array<string | null>,
) {
  const uniquePaths = [...new Set(paths.filter((value): value is string => Boolean(value)))];
  const result = new Map<string, string>();
  if (!uniquePaths.length) return result;

  const { data } = await supabase.storage.from("showcase-files").createSignedUrls(uniquePaths, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}

export function excerpt(value: string | null, length = 150) {
  if (!value) return null;
  return value.length > length ? `${value.slice(0, length).trimEnd()}…` : value;
}
