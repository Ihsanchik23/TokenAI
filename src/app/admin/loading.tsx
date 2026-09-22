export default function AdminLoading() {
  return <section className="studio-page" aria-label="Загрузка Studio"><div className="studio-loading-heading skeleton" /><div className="studio-loading-grid">{Array.from({ length: 4 }).map((_, index) => <div className="studio-loading-card skeleton" key={index} />)}</div><div className="studio-loading-panel skeleton" /></section>;
}
