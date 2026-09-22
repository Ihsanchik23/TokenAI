"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ensureCertificatePdf } from "@/lib/certificates";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function prepareCertificatePdfAction(certificateId: string) {
  await requireUser();
  if (!uuidPattern.test(certificateId)) return;
  const supabase = await createClient();
  await ensureCertificatePdf(supabase, certificateId);
  revalidatePath("/profile");
  revalidatePath("/my-courses");
}
