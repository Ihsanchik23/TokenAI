export function MarkdownContent({ value }: { value: string }) {
  return <div className="lesson-content">{value.split(/\n{2,}/).map((block, index) => block.startsWith("# ") ? <h2 key={index}>{block.slice(2)}</h2> : <p key={index}>{block}</p>)}</div>;
}
