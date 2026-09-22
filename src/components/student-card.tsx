import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PublicStudent } from "@/lib/showcase";
import { excerpt } from "@/lib/showcase";
import { getAvatarUrl } from "@/lib/storage";

export function StudentCard({ student }: { student: PublicStudent }) {
  const avatarUrl = getAvatarUrl(student.avatarPath);
  const name = student.displayName ?? student.username;
  return (
    <Link className="student-list-link" href={`/students/${student.username}`}>
      <article className="student-list-row">
        <div className="avatar student-list-avatar">
          {avatarUrl ? <Image src={avatarUrl} alt="" width={72} height={72} unoptimized /> : <span>{name.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="student-list-identity">
          <h2>{name}</h2>
          <p className="handle">@{student.username}</p>
        </div>
        <div className="student-list-about">
          {student.bio ? <p>{excerpt(student.bio, 120)}</p> : student.topics.length ? <div className="student-topic-list">{student.topics.slice(0, 3).map((topic) => <span key={topic.id}>{topic.name}</span>)}</div> : <p className="muted">Публичный профиль TokenAI</p>}
        </div>
        <ArrowUpRight className="student-row-arrow" aria-hidden="true" size={20} />
      </article>
    </Link>
  );
}
