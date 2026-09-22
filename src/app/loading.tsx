export default function Loading() {
  return (
    <main className="page-shell loading-page" aria-busy="true" aria-label="Загрузка">
      <div className="loading-line loading-kicker" />
      <div className="loading-line loading-title" />
      <div className="loading-line loading-copy" />
      <div className="loading-grid">
        <div className="loading-card" />
        <div className="loading-card" />
        <div className="loading-card" />
      </div>
    </main>
  );
}
