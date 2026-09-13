const REPO_URL = 'https://github.com/Coding-Moves/diskern'
const ORG_URL = 'https://github.com/Coding-Moves'
const CONTACT_URL = 'https://github.com/Muawiya-contact'

export default function Support() {
  return (
    <main className="support-page container">
      <section className="support-hero" aria-labelledby="support-title">
        <p className="support-eyebrow">Sponsor open source maintenance</p>
        <h1 id="support-title">Support Coding Moves</h1>
        <p className="support-lead">
          Your sponsorship helps maintain Diskern and future Coding Moves
          projects: development time, testing, releases, documentation,
          design polish, and contributor support.
        </p>
        <div className="support-actions">
          <a className="support-button support-button-primary" href={CONTACT_URL}>
            Discuss sponsorship
          </a>
          <a className="support-button" href={REPO_URL}>
            View Diskern on GitHub
          </a>
        </div>
      </section>

      <section className="support-card" aria-labelledby="payment-title">
        <h2 id="payment-title">Professional payment setup</h2>
        <p>
          GitHub Sponsors is currently pending for Coding Moves, so sponsors can
          use an external payment route for now. For international sponsors,
          Wise is the preferred option because it is built for cross-border
          transfers and avoids publishing raw bank details in the repository.
        </p>
        <p>
          If you would like to sponsor this work, please contact the maintainer
          first. The maintainer can then share the correct Wise payment link or
          invoice details privately.
        </p>
      </section>

      <section className="support-grid" aria-label="What sponsorship funds">
        <article className="support-card">
          <h2>What it funds</h2>
          <ul>
            <li>Core Rust engine work and safety improvements.</li>
            <li>Desktop UI polish, performance, and release packaging.</li>
            <li>Documentation, contributor guidance, and issue triage.</li>
            <li>Testing across Linux, Windows, and future platforms.</li>
          </ul>
        </article>

        <article className="support-card">
          <h2>Current sponsor route</h2>
          <ul>
            <li>Primary route: Wise payment link shared privately.</li>
            <li>Local route: Pakistan bank transfer only when arranged directly.</li>
            <li>Future route: GitHub Sponsors once the account is approved.</li>
          </ul>
        </article>
      </section>

      <section className="support-card" aria-labelledby="trust-title">
        <h2 id="trust-title">Why details are not listed publicly</h2>
        <p>
          Public repositories should not expose personal bank account numbers,
          branch details, or sensitive payment identifiers. Keeping payment
          details private protects the maintainer while still giving sponsors a
          clear professional path to support the project.
        </p>
        <p>
          Explore more work from <a href={ORG_URL}>Coding Moves</a> or open a
          discussion in the repository if you want to support a specific feature
          area.
        </p>
      </section>
    </main>
  )
}
