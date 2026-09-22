import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ShowcaseWork } from "@/lib/showcase";

export function ShowcaseCard({ work, priority = false }: { work: ShowcaseWork; priority?: boolean }) {
  return (
    <article className="showcase-tile">
      <Link className="showcase-tile-link" href={`/showcase/${work.id}`} aria-label={`Открыть работу «${work.title}»`}>
        <div className="showcase-tile-media">
          {work.coverUrl ? <Image src={work.coverUrl} alt={`Работа «${work.title}»`} width={900} height={700} sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 33vw" priority={priority} /> : <div className="showcase-missing-media"><span>TokenAI</span><small>Изображение не добавлено</small></div>}
          <span className="showcase-open-icon"><ArrowUpRight aria-hidden="true" size={20} /></span>
        </div>
        <div className="showcase-caption"><div><h2>{work.title}</h2><p>{work.author ? work.author.displayName ?? `@${work.author.username}` : "Участник TokenAI"}</p></div><span>{work.topic.name}</span></div>
      </Link>
    </article>
  );
}
