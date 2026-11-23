# Qiraa · قراءة

A calm, bilingual (Arabic + English) reading platform. Upload your own PDFs or open free, openly licensed books and papers, and read with **Smart Reading Assist**, which marks difficult words and people and explains them on hover.

> "Qiraa" is a placeholder name. Rename it in [`lib/brand.ts`](lib/brand.ts).

## Status

| Phase | What | State |
|---|---|---|
| 0 | Foundation: Arabic/English + RTL, themes, fonts, data model, sign-in, app shell | ✅ done |
| 1 | Upload, Library, Original (PDF) reader, resume position | ✅ done |
| 2 | Reading mode, highlights/notes/bookmarks, search, focus mode, shortcuts | next |
| 3 | Smart Reading Assist | |
| 4 | My Words + flashcards + CSV/Anki export | |
| 5 | Explore: Gutendex, DOAB, OpenAlex, arXiv, ACO | |
| 6 | Daily sync, README completion, full test pass | |

## Tech stack

- **Next.js 16** (App Router, Turbopack), **TypeScript**, **Tailwind CSS 4**, **shadcn/ui** (Radix, RTL-aware)
- **next-intl** for `/ar` and `/en` routes. Arabic is the default; the browser language picks the first visit.
- **Supabase** for Postgres, Auth (email link, optional Google) and file storage
- **Prisma 7** with the `pg` driver adapter
- **TanStack Query**, **Zustand**, **Motion**
- **Vitest** for tests
- Deploys to **Vercel**

## Setup

You need **Node 20.9+** (24 recommended). For the real thing you need a free **Supabase** project; to try it out first, use [local mode](#local-mode-no-supabase-yet).

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

1. Go to <https://supabase.com/dashboard> and create a new project. Keep the database password.
2. Copy `.env.example` to `.env.local`.
3. Fill in the Supabase values:
   - **Project Settings → API Keys**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`.
   - **Connect → ORMs → Prisma**: `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (direct, port 5432).
4. Open **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` for now. Change it to your production URL later.
   - **Redirect URLs**: add `http://localhost:3000/api/auth/callback`, and later `https://YOUR-DOMAIN/api/auth/callback`.
5. *(Optional)* Turn on Google sign-in. Enable it under **Authentication → Sign In / Providers → Google** with a Google OAuth client, then set `NEXT_PUBLIC_AUTH_GOOGLE=true`.

### 3. Create the tables

```bash
npm run db:migrate
```

This also enables Row Level Security on every table with no policies. Supabase's public API therefore exposes nothing, and all data access goes through this app's server code, which checks the signed-in user.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>. The app works without Supabase keys too: you can browse the shell, and sign-in shows a "not configured" notice.

## Local mode (no Supabase yet)

Running `npm run dev` without Supabase keys switches the app into local mode:

- a fixed local user (no sign-in)
- a project-only PostgreSQL database
- files stored in `.local/storage`

Local mode never turns on in a production build. You need PostgreSQL 15+ installed (`initdb`, `pg_ctl` on your PATH). To set it up once:

```bash
initdb -D .local/pg -U postgres --auth=trust -E UTF8 --locale=C
echo "port = 54329" >> .local/pg/postgresql.conf
npm run local:db
createdb -h localhost -p 54329 -U postgres qiraa
```

Then put the following in `.env.local`:

```bash
DATABASE_URL="postgresql://postgres@localhost:54329/qiraa"
DIRECT_URL="postgresql://postgres@localhost:54329/qiraa"
```

Run `npm run db:migrate` and `npm run dev`. Use `npm run local:db` to start the database again after a restart, and `npm run local:db:stop` to stop it.

When you add your Supabase keys to `.env.local` (replacing the two local URLs), the app switches to Supabase automatically. It creates the private `library` storage bucket on first upload.

### Test PDFs

`node scripts/make-test-pdfs.mjs` generates sample files into `.local/fixtures` using headless Chrome:

- an English book with a table of contents
- an 841-page book
- an Arabic book
- a two-column research paper
- an image-only "scanned" PDF

## Environment variables

Every variable is listed in [`.env.example`](.env.example). Only `NEXT_PUBLIC_*` values reach the browser.

| Variable | Needed from | Where to get it (free) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Phase 0 | Supabase → Project Settings → API Keys |
| `DATABASE_URL`, `DIRECT_URL` | Phase 0 | Supabase → Connect → ORMs → Prisma |
| `NEXT_PUBLIC_AUTH_GOOGLE` | optional | `true` after enabling Google in Supabase |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | optional | Upload size limit, default `50`. That's Supabase Free's per-file cap; raise it on Pro. |
| `AI_PROVIDER` | Phase 3 | `gemini` |
| `GEMINI_API_KEY` | Phase 3 | <https://aistudio.google.com/apikey> |
| `OPENALEX_API_KEY` | Phase 5 | <https://openalex.org> → account → API key |
| `CORE_API_KEY` | Phase 6 | <https://core.ac.uk/services/api> |
| `SEMANTIC_SCHOLAR_API_KEY` | optional | <https://www.semanticscholar.org/product/api#api-key> |
| `CRON_SECRET` | Phase 5 | any long random string |

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Add the same environment variables in **Vercel → Settings → Environment Variables**.
3. Add your production callback URL to Supabase (see step 2.4 above).

`postinstall` runs `prisma generate` on every deploy. Run `npm run db:migrate` locally against production whenever the schema changes.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run db:migrate` | Apply migrations (uses `DIRECT_URL`) |
| `npm run db:migrate:dev` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:studio` | Browse the database |
| `npm run local:db` / `local:db:stop` | Start / stop the local-mode database |

## Project layout

```
app/[locale]/(app)/    Home, Library, Explore, My Words, Settings (with header + tabs)
app/[locale]/(auth)/   Sign-in
app/api/               Route handlers (auth callback; later upload, proxy, assist, sync)
components/            ui/ (shadcn), shell/, auth/, providers/
hooks/                 Client hooks (theme)
i18n/                  Locale routing, navigation and message loading
messages/              en.json, ar.json (UI text)
lib/                   auth, db (Prisma), supabase/, preferences/, fonts, brand
prisma/                schema.prisma + migrations
proxy.ts               Session refresh + locale routing + page protection
tests/                 Vitest tests
```

## Design notes

- **Themes**: Light, Sepia, Dark and True Black. An inline `<head>` script applies the saved theme (a cookie) before first paint, so there's no flash and no hydration mismatch. The tokens are in `app/globals.css`.
- **RTL**: `<html dir>` comes from the locale. Components use logical properties (`ms-`, `ps-`, `start-`) so layouts mirror automatically.
- **Shared content**: files are stored once per SHA-256 (`Content`). Text extraction and Smart Assist results attach to the content, not the user, so a book is processed once no matter how many people read it. Each person's library, notes, progress and words are their own (`Document`, `Annotation` and so on).
- **Uploads** go straight from the browser to storage through a one-time signed URL. That keeps them off Vercel's 4.5 MB request limit and gives a real progress bar. The browser first reads the PDF itself for the title, author, page count, table of contents, cover, language and type. The server then re-hashes the stored file before accepting it, so nobody can claim someone else's file by its hash.
- **The reader** (Original mode) only renders the pages near the screen: a canvas plus pdf.js's text layer for selection. pdf.js fetches only the byte ranges it needs, so 500+ page books open quickly. The position is saved as you read and when the tab closes, then restored to the same spot.
- **AI quota**: the Gemini free-tier quota belongs to one API key and is shared by all users. `AiUsage` tracks project-wide use and `AiUserUsage` caps each person's daily share.
