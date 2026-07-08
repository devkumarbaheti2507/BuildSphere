export function SettingsPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="section-label">Local configuration</p>
          <h1>Settings</h1>
        </div>
      </div>
      <section className="content-band settings-list">
        <div>
          <span>API endpoint</span>
          <code>
            {import.meta.env.VITE_API_URL ?? "http://localhost:8080/api"}
          </code>
        </div>
        <div>
          <span>Session storage</span>
          <strong>Current browser tab</strong>
        </div>
        <div>
          <span>AI mode</span>
          <strong>Rule based</strong>
        </div>
        <div>
          <span>Deployment mode</span>
          <strong>Generate and validate only</strong>
        </div>
      </section>
    </>
  );
}
