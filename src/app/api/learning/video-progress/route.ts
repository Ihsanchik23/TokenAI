import { NextResponse } from "next/server";
import { preparePendingCertificatesForUser } from "@/lib/certificates";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const lessonId = String(body.lessonId ?? "");
  const position = Math.max(0, Math.round(Number(body.position ?? 0)));
  const watchedDelta = Math.max(0, Math.round(Number(body.watchedDelta ?? 0)));
  const duration = Math.max(0, Math.round(Number(body.duration ?? 0)));
  if (!uuidPattern.test(lessonId) || !Number.isFinite(position) || !Number.isFinite(watchedDelta) || !Number.isFinite(duration)) return NextResponse.json({ error: "Invalid progress" }, { status: 400 });

  const { data, error } = await supabase.rpc("save_video_progress", {
    target_lesson_id: lessonId,
    video_position_seconds: position,
    watched_seconds_delta: Math.min(watchedDelta, 30),
    reported_duration_seconds: duration,
  });
  if (error) return NextResponse.json({ error: "Progress was not saved" }, { status: error.code === "42501" ? 403 : 400 });
  const progress = Array.isArray(data) ? data[0] : data;
  if (progress?.status === "completed") await preparePendingCertificatesForUser(supabase, userId);
  return NextResponse.json({ status: progress?.status, progressPercent: progress?.progress_percent ?? 0 });
}
