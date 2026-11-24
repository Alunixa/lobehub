ALTER TABLE "user_core_memory" ADD COLUMN IF NOT EXISTS "last_extraction_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_core_memory" ADD COLUMN IF NOT EXISTS "last_extraction_error" text;--> statement-breakpoint
ALTER TABLE "user_core_memory" ADD COLUMN IF NOT EXISTS "last_recall_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_core_memory" ADD COLUMN IF NOT EXISTS "last_recall_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_core_memory" ADD COLUMN IF NOT EXISTS "retrieval_mode" text;--> statement-breakpoint
ALTER TABLE "user_episodic_memories" ADD COLUMN IF NOT EXISTS "embedding_model" text;--> statement-breakpoint
ALTER TABLE "user_episodic_memories" ADD COLUMN IF NOT EXISTS "search_tokens" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "memory_backfill_state" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_episodic_memories_search_tokens_idx" ON "user_episodic_memories" USING gin ("search_tokens");
--> statement-breakpoint
-- Preserve old memories and index both Latin words and Chinese characters/bigrams.
UPDATE "user_episodic_memories" m
SET "search_tokens" = ARRAY(
  SELECT DISTINCT token FROM (
    SELECT lower(match[1]) AS token
    FROM regexp_matches(m.content, '([a-zA-Z0-9_]+)', 'g') AS match
    UNION ALL
    SELECT substr(m.content, i, 1) FROM generate_series(1, length(m.content)) AS i
    WHERE substr(m.content, i, 1) ~ '[㐀-鿿]'
    UNION ALL
    SELECT substr(m.content, i, 2) FROM generate_series(1, greatest(0, length(m.content)-1)) AS i
    WHERE substr(m.content, i, 2) ~ '^[㐀-鿿]{2}$'
  ) words WHERE token <> '' LIMIT 256
)
WHERE cardinality(m.search_tokens) = 0;
