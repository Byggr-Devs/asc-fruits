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

Migration `20261117180000_name_ta.sql` (optional Tamil names for fruits, varieties and vendors) must be pushed with `supabase db push --remote` before the bilingual UI works against the database.

## Language

The UI is bilingual (English / Tamil). Use the language toggle in the app; the choice is remembered in the browser. Fruits, varieties and vendors have an English name plus an optional Tamil name (`name_ta`), edited in the Fruits & Varieties and Vendors screens. When no Tamil name is set, the English name is shown. Generated order PDFs stay English for now.

## Users

There is no sign up. Create users in the Supabase dashboard under Authentication > Users (email + password, auto confirm). Every signed-in user has full access. When no users exist, the app shows a setup screen with these instructions.

See `DESIGN_SYSTEM.md` for colors, type and spacing.
