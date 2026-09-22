import Image from "next/image";
import Link from "next/link";
import type { PublicStudent } from "@/lib/showcase";
import { excerpt } from "@/lib/showcase";
import { getAvatarUrl } from "@/lib/storage";

export function StudentCard({ student }: { student: PublicStudent }) {
  const avatarUrl = getAvatarUrl(student.avatarPath);
  const name = student.displayName ?? student.username;
  return (
    <article className="card student-card stack">
      <div className="student-card-header">
        <div className="avatar student-avatar">
          {avatarUrl ? <Image src={avatarUrl} alt={`Аватар ${name}`} width={64} height={64} unoptimized /> : <span>{name.charAt(0).toUpperCase()}</span>}
        </div>
        <div>
          <h2>{name}</h2>
          <p className="handle">@{student.username}</p>
        </div>
      </div>
      {student.bio && <p className="muted">{excerpt(student.bio)}</p>}
      <div className="tag-list">{student.topics.map((topic) => <span className="tag" key={topic.id}>{topic.name}</span>)}</div>
      <p className="field-help">Завершено курсов: {student.completedCourseCount} · Работ: {student.publishedWorkCount}</p>
      <Link href={`/students/${student.username}`}>Открыть профиль</Link>
    </article>
  );
}
