# APP_NAME

Board-exam intelligence platform for Std 12 Physics (CBSE + Maharashtra). Students follow a guided year-long progression of exams, never see the same question twice, and learn which concepts they are weakest on.

This repo is **Phase 0**: the engine scaffold on mock Physics content. No AI generation, no real papers, no studio, no Gold tier yet.

> Working name is a placeholder (`APP_NAME`) pending IP India trademark clearance. Do not print a final brand name anywhere public until confirmed.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Supabase (Postgres + Auth)
- Tailwind CSS v4 (Zenith design tokens)
- Vercel (deploy)

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and fill in your Supabase values:
   ```bash
   cp .env.example .env.local
   ```
   Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project (Project Settings -> API). The scaffold builds and runs even before these are filled.
3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Scripts

- `npm run dev` start the dev server
- `npm run build` production build
- `npm run start` run the production build
- `npm run lint` lint
