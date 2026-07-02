# Des Moines Fencing Club website

The public website for the [Des Moines Fencing Club](https://www.desmoinesfencingclub.org),
a 501(c)(3) non-profit fencing club teaching foil, épée, and saber to
fencers of all ages in central Iowa.

This repository contains the source for the redesigned site. The site
itself is built and maintained by club volunteers.

## Tech stack

- **[Next.js](https://nextjs.org)** 16 (App Router, TypeScript)
- **[React](https://react.dev)** 19
- **[Tailwind CSS](https://tailwindcss.com)** 4 (CSS-first configuration)
- **[MDX](https://mdxjs.com)** for news and tournament content
- **Vercel** for hosting and deployment

Phase 2 (planned): **[Supabase](https://supabase.com)** for auth and
member data, **[Resend](https://resend.com)** for transactional email.

## Running locally

You'll need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

The site will be available at http://localhost:3000.

## Project layout

```
src/
  app/             Next.js App Router pages (one folder per route)
  components/      Shared React components
  lib/             Server-side utilities (news loader, etc.)
  mdx-components.tsx   Global MDX element styling
content/
  news/            MDX files for news entries and tournaments
public/            Static assets (logo, coach photos, etc.)
supabase/
  config.toml      Supabase project config (auth, email templates) as code
  templates/       Auth email HTML (e.g. magic_link.html)
  migrations/      Database schema migrations
```

## Editing news and tournament entries

News announcements and tournament listings are MDX files in
`content/news/`. To add a new entry, copy one of the templates in
`content/news/_templates/`, rename it using the `YYYY-MM-DD-slug.mdx`
convention, and fill in the frontmatter. Full instructions are in
[`content/news/README.md`](./content/news/README.md).

## Editing authentication emails

The **member sign-in ("magic link") email** is sent by Supabase Auth, not
by Resend. (Resend + React Email under `src/emails/` powers the separate
observation-request emails.) Its design lives in
[`supabase/templates/magic_link.html`](./supabase/templates/magic_link.html)
— a plain, email-safe HTML file (table layout, inlined styles) that mirrors
the club branding. Edit that file to change how the email looks.

The template is deployed **as code** via the Supabase CLI rather than the
dashboard, so the file stays the source of truth:

```bash
# One-time setup
npx supabase login
npx supabase link --project-ref gevdecxvpvopvdjjpaum

# After editing the template (or config.toml), deploy:
npx supabase config push        # review the diff, answer Yes to Auth
```

`config.toml` is wired to the template via `[auth.email.template.magic_link]`.
A few things to know before pushing:

- **`config push` treats `config.toml` as the source of truth for *all*
  auth config.** Its other auth settings (`site_url`, redirect URLs, MFA,
  OTP length, etc.) are deliberately set to match the live project so the
  push diff shows *only* the template. If the diff wants to change anything
  else, reconcile `config.toml` to match production first — don't confirm a
  push that touches unrelated settings.
- **SMTP is managed in the Supabase dashboard, not in `config.toml`,** on
  purpose. Leaving it out means a `config push` never risks blanking the
  live SMTP credentials. Don't add an `[auth.email.smtp]` block unless you
  also keep its `env(...)` secret set locally.
- **Images must be absolute, public URLs — and not SVG.** The logo uses
  `https://dmfc-site.vercel.app/logo.png` (the production Vercel alias);
  relative paths, auth-protected preview URLs, and SVGs won't render in
  mail clients.
- **Don't run `supabase db push`.** The local `migrations/` folder isn't
  fully reconciled with the remote migration history; `config push` is
  unaffected (it never touches the database), but a `db push` would
  mis-compare migration state.

## Production builds

```bash
npm run build
npm run start
```

Deploys to production happen automatically when commits land on `main`
via Vercel's GitHub integration.

## License

Copyright © Des Moines Fencing Club. All rights reserved.

The code is published publicly for transparency. No license is granted
for reuse; if you'd like to adapt any of it for another non-profit
club's site, get in touch via [DMFCPresident@gmail.com](mailto:DMFCPresident@gmail.com).
