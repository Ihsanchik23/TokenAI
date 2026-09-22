import Image from "next/image";
import Link from "next/link";
import type { ShowcaseWork } from "@/lib/showcase";
import { excerpt } from "@/lib/showcase";

export function ShowcaseCard({ work }: { work: ShowcaseWork }) {
  return (
    <article className="course-card">
      {work.coverUrl
        ? <Image src={work.coverUrl} alt={`Обложка ${work.title}`} width={640} height={360} unoptimized />
        : <div className="cover-placeholder">Showcase</div>}
      <div className="card-body stack">
        <div className="actions split"><span className="tag">{work.topic.name}</span><small className="muted">{new Date(work.publishedAt).toLocaleDateString("ru-RU")}</small></div>
        <h2>{work.title}</h2>
        {work.description && <p className="muted">{excerpt(work.description)}</p>}
        <p className="field-help">
          Автор: {work.author
            ? <Link href={`/students/${work.author.username}`}>{work.author.displayName ?? `@${work.author.username}`}</Link>
            : "Участник TokenAI"}
        </p>
        {work.relatedCourse && <p className="field-help">Курс: {work.relatedCourse.status === "published" ? <Link href={`/courses/${work.relatedCourse.slug}`}>{work.relatedCourse.title}</Link> : work.relatedCourse.title}</p>}
        <Link href={`/showcase/${work.id}`}>Открыть работу</Link>
      </div>
    </article>
  );
}
