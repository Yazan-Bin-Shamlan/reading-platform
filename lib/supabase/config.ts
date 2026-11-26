// Public values (safe in the browser). Referenced statically so Next inlines them.
// The Supabase integration on Vercel sets NEXT_PUBLIC_SUPABASE_ANON_KEY; it is kept
// in sync with the project, so it wins over a publishable key added by hand.

/** A value pasted with its quotes from a .env file ("https://…") still works. */
export const unquote = (v: string | undefined) => v?.trim().replace(/^(["'])(.*)\1$/, "$2") || undefined;

const url = unquote(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = unquote(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? unquote(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/** null until Supabase keys are added to .env.local — the app still runs without them. */
export const supabaseConfig = url && key ? { url, key } : null;
