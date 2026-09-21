import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getEnrollment(userId: string, courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id,status,access_source,started_at,completed_at,expires_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .in("status", ["active", "completed"])
    .maybeSingle();

  if (data?.expires_at && new Date(data.expires_at) <= new Date()) return null;
  return data;
}

export async function getMyPurchaseHistory(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id,course_id,amount,currency,status,created_at,payments(id,provider,status,amount,paid_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("PURCHASE_HISTORY_LOAD_FAILED");
  return data ?? [];
}
