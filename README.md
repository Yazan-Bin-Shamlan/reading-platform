# Qiraa · قراءة

A calm, bilingual (Arabic + English) reading platform. Upload your own PDFs or open free, openly licensed books and papers, and read with **Smart Reading Assist**, which marks difficult words and people and explains them on hover.

> "Qiraa" is a placeholder name. Rename it in [`lib/brand.ts`](lib/brand.ts).

## Status

| Phase | What | State |
|---|---|---|
| 0 | Foundation: Arabic/English + RTL, themes, fonts, data model, sign-in, app shell | ✅ done |
| 1 | Upload, Library, Original (PDF) reader, resume position | ✅ done |
| 2 | Reading mode, highlights/notes/bookmarks, search, focus mode, shortcuts | ✅ done |
| 3 | Smart Reading Assist | ✅ done |
| 4 | My Words + flashcards + CSV/Anki export | ✅ done |
| 5 | Explore: Gutendex, DOAB, OpenAlex, arXiv, ACO | ✅ done |
| 6 | More sources (Internet Archive, Europe PMC, Hindawi link-out), full test pass | ✅ done |

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
   - **Connect → ORMs → Prisma**: `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (**Session pooler**, port 5432 on `pooler.supabase.com`; the direct connection is IPv6-only and Vercel can't reach it).
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
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | required | Supabase → Project Settings → API Keys. Leave them out in development for local mode |
| `DATABASE_URL`, `DIRECT_URL` | required | Supabase → Connect → ORMs → Prisma (transaction pooler and session pooler). In local mode, both point at the local database |
| `NEXT_PUBLIC_AUTH_GOOGLE` | optional | `true` after enabling Google in Supabase |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | optional | Upload size limit, default `50`. That's Supabase Free's per-file cap; raise it on Pro. |
| `AI_PROVIDER` | optional | `gemini` (the default). Without a key in local development, a labelled demo provider stands in. |
| `GEMINI_API_KEY` | required for Smart Assist | <https://aistudio.google.com/apikey>. Server-only: never prefix it with `NEXT_PUBLIC_` |
| `GEMINI_MODEL_FAST`, `GEMINI_MODEL_SMART`, `GEMINI_MODEL_SPEECH` | optional | Defaults `gemini-3.5-flash-lite` (marking pages, word lookups), `gemini-3.8-flash` ("Explain more", passages) and `gemini-3.8-flash-lite-tts` (the AI voice): free-tier models as of Nov 2026 |
| `AI_DAILY_LIMIT_FAST`, `AI_DAILY_LIMIT_SMART`, `AI_DAILY_LIMIT_SPEECH`, `AI_USER_DAILY_LIMIT`, `AI_MIN_INTERVAL_MS` | optional | Caps on the shared free quota: requests per day per model (1000 / 200 / 100), per reader per day (300, all kinds together), and spacing between requests to one model (4000 ms ≈ 15 a minute) |
| `APP_CONTACT` | recommended | Your email or site, sent in the User-Agent to Wikipedia/Wikidata and the Explore sources as their policies ask. Wikimedia allows 200 lookups a minute with it, 10 without |
| `OPENALEX_API_KEY` | optional | <https://openalex.org> → account → API key. Search works without one; a free key raises the daily budget |
| `CRON_SECRET` | required on Vercel | Any long random string. Vercel Cron sends it to `/api/cron/sync` (daily DOAB + arXiv sync, see `vercel.json`) |
| `SYNC_DOAB_FIRST_DAYS`, `SYNC_ARXIV_FIRST_DAYS` | optional | How far back the first sync reaches (defaults 60 and 7 days). Later runs only fetch what changed |

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Add the same environment variables in **Vercel → Settings → Environment Variables**. For `DIRECT_URL`, use Supabase's **Session pooler** string (port 5432 on `pooler.supabase.com`): the direct connection is IPv6-only, which Vercel's build machines can't reach.
3. Add your production callback URL to Supabase (see step 2.4 above).

`postinstall` runs `prisma generate` and `scripts/setup-pdfjs.mjs` (see [Design notes](#design-notes)). Vercel then runs `vercel-build`, which applies any new migrations (`prisma migrate deploy`) before `next build`, so the production database is always up to date with the code being deployed.

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
app/api/               Route handlers: auth callback, uploads, documents (text pages,
                       annotations, progress, assist), assist, words, explore,
                       proxy (large remote PDFs), cron (daily sync), preferences,
                       local storage
components/            ui/ (shadcn), shell/, auth/, providers/, upload/, library/,
                       reader/ (shell, Original and Reading views, panels, Smart Assist),
                       words/, explore/
hooks/                 Client hooks (theme, page text, annotations, progress saving)
i18n/                  Locale routing, navigation and message loading
messages/              en.json, ar.json (UI text)
lib/                   words/ (flashcard scheduling, CSV/Anki export), ai/ (provider
                       interface, Gemini, demo, prompts, quota), assist/
                       (placing and filtering marks), entities/ (Wikidata, Wikipedia),
                       sources/ (Explore adapters, license rules, sync, import),
                       auth, db (Prisma), supabase/, storage/, pdf/, upload/, library/,
                       text/ (reflow, extraction, search, HTML and JATS), reader/ (layout, prefs,
                       annotations, export), preferences/, fonts, brand
scripts/               pdf.js setup (postinstall), test PDF generator
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
- **Reading mode** shows the PDF's text reflowed: your font, size, spacing, line length, margins and alignment. The server extracts each document once, right after upload, in the background (pdf.js in Node, about 2 s per 1,000 pages) and stores it per page (`ContentPage`). [`lib/text/reflow.ts`](lib/text/reflow.ts) rebuilds reading order from the PDF's positioned fragments. It joins lines into paragraphs, follows two-column layouts and spots headings. It drops page numbers and running headers, re-joins hyphenated words, and for Arabic puts split-off diacritics back on their letters and orders mixed Arabic/English lines. Scanned PDFs have no text, so they open in Original mode only (OCR comes later).
- **pdf.js patch**: pdf.js reverses Arabic lam-alef ligatures when extracting text ("الأميرة" came out "األميرة"). `scripts/setup-pdfjs.mjs` patches that one line in both the server build and the browser worker, and fails loudly if a pdf.js upgrade moves the code.
- **One position model**: everything (reading position, highlights, notes, search results) is a page plus a place on it, so both modes share them. Each character of the extracted text maps back to the PDF text layer's spans. That is how a highlight made in Reading mode shows up on the original page, and the reverse.
- **Highlights** are drawn with the CSS Custom Highlight API, which adds no extra elements to the text. Notes export as Markdown from the Notes panel.
- **Fonts**: `lib/fonts.ts` builds the Latin + Arabic stacks itself. next/font's metric fallback for a Latin font (e.g. "Geist Fallback", which is local Arial) has no `unicode-range`, so it would grab Arabic letters before the Arabic font loads.
- **Smart Reading Assist**: when a page comes into view, the server asks the AI about it and the next three pages in the background, one request per page. Every result is cached per document page, so a page is never analysed twice for anyone.
  - The model returns each word or name with its paragraph number and exact wording, not character offsets (models count characters badly). [`lib/assist/locate.ts`](lib/assist/locate.ts) finds the position, tolerating case and Arabic diacritics. The same position marks both the PDF and Reading mode.
  - Every term carries its own difficulty (1–5, mapped to CEFR) plus explanations in English and Arabic. Your level, the density slider, "I know this word" and the explanation language then filter in the browser, so changing them is instant and uses no quota.
  - Facts about people, places, organisations and events come from Wikidata and Wikipedia, cached for 30 days. The AI only says why they're mentioned. When no confident match exists (exact name, right kind), the card says so instead of guessing.
  - All AI calls go through [`lib/ai/provider.ts`](lib/ai/provider.ts) (`analyzePage`, `explainTerm`, `explainMore`, `explainParagraph`), so another provider is one new file plus `AI_PROVIDER`.
  - A per-document switch keeps a document's text away from the AI entirely.
- **Reading aloud** ([`lib/speech.ts`](lib/speech.ts)): any selection or highlight has a Listen button, as do word cards, My Words and flashcards. Settings → Pronunciation chooses between two voices, kept per device:
  - **Device voice** (the default): the browser's own voices, free and instant. The most natural installed voice for each language is picked automatically (joke and robotic voices are skipped), or people choose one. Long passages are read sentence by sentence, and a selection that starts or ends mid-word is widened to whole words.
  - **AI voice**: Gemini's speech model through `/api/speech`, in 30 voices that speak English and Arabic. A passage is read in pieces (a short first one so it starts within a few seconds; the next is fetched while the current one plays). Every clip is stored once per voice and text, so a sentence anyone has heard before costs no quota. It counts towards the same daily caps as Smart Assist, with its own request queue; when it isn't available (limit reached, busy, no key), the device voice reads instead and a note says why.
- **My Words** keeps each saved word with its translation, meaning and the sentence it came from. A link opens the book at that exact spot and flashes the word. Flashcards use a small SM-2 (the scheduling behind Anki): a word you know comes back after longer and longer gaps, one you forget comes back in ten minutes. Export as CSV (with a byte-order mark so Excel shows Arabic correctly) or as a file for Anki's **File → Import** (Basic notes, HTML, deck "Qiraa: My Words").
- **Explore** (`lib/sources/`): one adapter per source, all returning the same record shape. Only public-domain or Creative Commons items get through (`lib/sources/license.ts`), and each one shows its license and attribution.
  - **Searched live**, with responses cached for 6 hours: Project Gutenberg (via Gutendex), OpenAlex, Arabic Collections Online, the Internet Archive and Europe PMC.
  - **Internet Archive**: only library scans the scanning library marked "not in copyright" and published by 1930 (public domain in the US as of 2026). Licenses that uploaders set themselves are ignored: many are wrong. The item's PDF is found through IA's metadata API when someone opens it. IA's Arabic text layers are unreadable OCR, so Arabic books open as scans.
  - **Europe PMC**: open-access articles in PubMed Central with a CC/CC0 license on the record. They open in Reading mode from the full text XML its REST API serves (JATS, converted in [`lib/text/jats.ts`](lib/text/jats.ts)). The site's PDF links sit behind a browser check, so they aren't used. Its API can take up to half a minute on common words; Explore shows the other sources meanwhile, and the answer is cached for the next search.
  - **Backup covers from [Open Library](https://openlibrary.org)**: when a book's own cover doesn't load (Project Gutenberg down for maintenance, DOAB's anti-bot check), `/api/cover` looks the book up on Open Library, by ISBN when the source's file names carry one, else by title and author with the title checked. The cover ID it finds (or "none") is cached for 30 days, and the browser loads the image straight from `covers.openlibrary.org`, as Open Library asks. Lookups are spaced to its limit (1 a second, 3 with `APP_CONTACT` set). Papers keep the title card.
  - **Hindawi Foundation**: a link to its own site (Safahat) on Explore. Its books aren't listed or fetched, because its terms couldn't be confirmed to allow it.
  - **Left out**: CORE and Semantic Scholar don't give a reliable per-item open license (CORE's license field is mostly empty or free text; Semantic Scholar's open-access PDFs carry none), so their files couldn't be shown under the license rule. The Arab Journals Platform (`digitalcommons.aaru.edu.jo`) no longer resolves.
  - **Harvested daily** through their open OAI-PMH feeds: DOAB (its search API only admits registered addresses) and arXiv. arXiv's search API doesn't carry licenses, and arXiv's terms only allow re-serving papers whose license permits it, so we keep the CC/CC0 ones.
  - **Run the first sync locally**: `curl localhost:3000/api/cron/sync` (repeat to continue a long first harvest).
  - **Files are fetched only when someone opens an item**, through the server, and cached once per file. Project Gutenberg books and Europe PMC articles open in Reading mode from their text editions. Scans (ACO, the Internet Archive's Arabic books) open in Original mode.
  - **Limits**:
    - Files over 50 MB are read range by range through `/api/proxy` when the source supports ranges. ACO's large scans can't be read that way (pdf.js must read the whole file), so they link to ACO's viewer.
    - The OAPEN Library, which hosts most DOAB PDFs, blocks servers with an anti-bot check, so those books open on DOAB/OAPEN.
    - Requests to each source are spaced (arXiv: one every 3 seconds) and back off on 429/503.
- **AI quota**: the Gemini free-tier quota belongs to the Google project behind the API key and is shared by all users. `AiUsage` tracks project-wide use and `AiUserUsage` caps each person's daily share. Requests are queued and spaced. Per-minute limits (HTTP 429) and a busy model (503, which the free tier returns at peak times) are retried with backoff, and longer explanations fall back to the fast model when the stronger one is overloaded. A daily-limit error pauses Smart Assist until midnight Pacific, when Google resets the quota. Marks already made stay, and the reader shows "Smart Assist paused until tomorrow — reading still works."
