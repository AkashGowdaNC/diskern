# diskern-site

Marketing/landing page for [Diskern](https://github.com/Coding-Moves/diskern), deployed to GitHub Pages.

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Test

```sh
npm test # regression checks for root theming and the initial page canvas
```

## Deploy

Pushing to `main` with changes under `site/` triggers
`.github/workflows/deploy-pages.yml`, which builds this project and
publishes `dist/` to GitHub Pages. See the root `docs/` for more.

The Vite `base` in `vite.config.js` is set to `/diskern/` to match this
repo's GitHub Pages URL (`coding-moves.github.io/diskern/` or your
configured custom domain). If the repo is ever renamed, update `base`
to match.

## Configure Wise sponsorship

The Support page uses a public Wise receiving/payment link. Bank details are
managed in Wise, not in the desktop app or this repository.
Supporters follow the link directly; the site does not require an invoice
request or a conversation with the maintainer before payment when configured.

For local development, copy `.env.example` to `.env.local` in this directory.
Set this value to the HTTPS payment link copied from your Wise account:

```dotenv
VITE_WISE_PAYMENT_URL=
```

Paste the link after the equals sign, then restart `npm run dev`.
The local file is ignored by Git. Only HTTPS links on `wise.com` are accepted;
a missing or invalid link shows “Discuss sponsorship” instead.

For the live site, open repository **Settings → Secrets and variables →
Actions → Variables → New repository variable**. Name it
`VITE_WISE_PAYMENT_URL` and paste the same public link as its value.
After this PR is merged, run **Actions → Deploy site to GitHub Pages →
Run workflow** on `main` to publish the setting. Updating a variable alone
does not rebuild the site.

Vite embeds this value in public JavaScript. Gitignore and GitHub secrets do
not make browser-visible values private. Do not put account numbers, passwords,
or Wise API tokens here. The GitHub Sponsor button continues to point to the
Support page through `.github/FUNDING.yml`.
