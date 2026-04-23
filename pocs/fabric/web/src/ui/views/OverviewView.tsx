export default function OverviewView(): JSX.Element {
  return (
    <section className="view">
      <h1 className="view__title">Overview</h1>
      <p className="view__lead">Fabric PoC web UI — manage marketplaces, kits, and agent registration, all against an in-memory mock.</p>
      <p className="view__hint">Select a section on the left to get started. Kits with web extensions will appear under Extensions after install.</p>
    </section>
  );
}
