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
```

## Editing news and tournament entries

News announcements and tournament listings are MDX files in
`content/news/`. To add a new entry, copy one of the templates in
`content/news/_templates/`, rename it using the `YYYY-MM-DD-slug.mdx`
convention, and fill in the frontmatter. Full instructions are in
[`content/news/README.md`](./content/news/README.md).

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
