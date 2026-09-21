import { requireUser } from "@/lib/auth";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return children;
}
