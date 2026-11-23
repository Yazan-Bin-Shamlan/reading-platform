/** Supabase's free plan caps each stored file at 50 MB. Raise this on Pro. */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50);
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
