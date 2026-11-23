-- Like every table: no policies, so Supabase's public Data API exposes nothing.
ALTER TABLE "SourceCache" ENABLE ROW LEVEL SECURITY;
