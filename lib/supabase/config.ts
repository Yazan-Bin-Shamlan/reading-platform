// Public values (safe in the browser). Referenced statically so Next inlines them.
// The Supabase integration on Vercel sets the project's address (SUPABASE_URL, passed
// on by next.config.ts) and NEXT_PUBLIC_SUPABASE_ANON_KEY; both are kept in sync with
// the project, so they win over values added by hand.

/** A value pasted with its quotes from a .env file ("https://…") still works. */
export const unquote = (v: string | undefined) => v?.trim().replace(/^(["'])(.*)\1$/, "$2") || undefined;

const isWebUrl = (v: string | undefined): v is string => Boolean(v && /^https?:\/\/[^\s"']+$/.test(v));

const url = [process.env.SUPABASE_PROJECT_URL, process.env.NEXT_PUBLIC_SUPABASE_URL].map(unquote).find(isWebUrl);
const key = unquote(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? unquote(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/** null until Supabase keys are added to .env.local — the app still runs without them. */
export const supabaseConfig = url && key ? { url, key } : null;
