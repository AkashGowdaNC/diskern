const REPO_URL = 'https://github.com/Coding-Moves/diskern'
const ORG_URL = 'https://github.com/Coding-Moves'
const CONTACT_URL = 'https://github.com/Muawiya-contact'

// Only publish a Wise HTTPS link; incomplete configuration keeps contact available.
function getWisePaymentUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'wise.com' &&
      !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

const WISE_PAYMENT_URL = getWisePaymentUrl(import.meta.env.VITE_WISE_PAYMENT_URL)

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
          <a className="support-button support-button-primary" href={WISE_PAYMENT_URL || CONTACT_URL}>
            {WISE_PAYMENT_URL ? 'Sponsor through Wise' : 'Discuss sponsorship'}
          </a>
          <a className="support-button" href={REPO_URL}>
            View Diskern on GitHub
          </a>
        </div>
      </section>

      <section className="support-card" aria-labelledby="payment-title">
        <h2 id="payment-title">Sponsor through Wise</h2>
        <p>
          Make a voluntary contribution to support ongoing maintenance.
          {WISE_PAYMENT_URL
            ? ' Follow the link to see the recipient and payment options on Wise before sending.'
            : ' Contact the maintainer to arrange a Wise payment.'}
        </p>
        <p>
          You can use the Wise link directly without requesting an invoice
          through this site. For sponsorship questions, visit the
          {' '}<a href={CONTACT_URL}>maintainer’s profile</a> for contact options.
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
            <li>Payments are handled through Wise.</li>
            <li>Future route: GitHub Sponsors once the account is approved.</li>
          </ul>
        </article>
      </section>

      <section className="support-card" aria-labelledby="trust-title">
        <h2 id="trust-title">Thank you for supporting the project</h2>
        <p>
          Every contribution helps us spend more time improving Diskern and
          supporting its contributors.
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
