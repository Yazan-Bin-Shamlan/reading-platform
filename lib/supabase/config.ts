// Public values (safe in the browser). Referenced statically so Next inlines them.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** null until Supabase keys are added to .env.local — the app still runs without them. */
export const supabaseConfig = url && key ? { url, key } : null;
