import Image from "next/image";
import Link from "next/link";
import type { PublicStudent } from "@/lib/showcase";
import { getAvatarUrl } from "@/lib/storage";

export function StudentCard({ student }: { student: PublicStudent }) {
  const avatarUrl = getAvatarUrl(student.avatarPath);
  const name = student.displayName ?? "Участник TokenAI";
  return (
    <Link className="student-list-link" href={`/students/${student.username}`}>
      <article className="student-list-row">
        <div className="avatar student-list-avatar">
          {avatarUrl ? <Image src={avatarUrl} alt="" width={72} height={72} unoptimized /> : <span>{name.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="student-list-identity">
          <h2>{name}</h2>
        </div>
      </article>
    </Link>
  );
}
