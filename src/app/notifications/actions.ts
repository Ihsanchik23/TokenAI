"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markNotificationReadAction(notificationId: string) {
  await requireUser();
  if (!uuidPattern.test(notificationId)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_notification_read", { target_notification_id: notificationId });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  await requireUser();
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
