export const courseLevels = ["beginner", "intermediate", "advanced"] as const;
export const courseAccessTypes = ["free", "paid", "private"] as const;
export const lessonTypes = ["theory", "video", "quiz", "assignment"] as const;

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function getYouTubeId(value: string) {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    const candidate =
      host === "youtu.be"
        ? url.pathname.split("/")[1]
        : host.endsWith("youtube.com")
          ? url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1)
          : null;
    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function getCourseCoverUrl(path: string | null) {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-covers/${encoded}`;
}

export function formatCoursePrice(accessType: string, amount: number | null, currency: string | null) {
  if (accessType === "free") return "Бесплатно";
  if (accessType === "private") return "Закрытый доступ";
  return `${Number(amount ?? 0).toLocaleString("ru-RU")} ${currency ?? "KZT"}`;
}
