# ASC Fruits

Fruit procurement, godown receiving and stock management. React + Vite + Tailwind v4 + TanStack Table/Query, backed by Supabase (project "Management System").

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm run dev
```

## Database

Migrations live in `supabase/migrations`. Apply them with:

```bash
supabase link --project-ref <ref>
supabase db push --remote
```

## Users

There is no sign up. Create users in the Supabase dashboard under Authentication > Users (email + password, auto confirm). Every signed-in user has full access. When no users exist, the app shows a setup screen with these instructions.

See `DESIGN_SYSTEM.md` for colors, type and spacing.
