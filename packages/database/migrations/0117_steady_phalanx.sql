CREATE TABLE "user_core_memory" (
	"user_id" text PRIMARY KEY NOT NULL,
	"persona_tone" text,
	"user_core" text,
	"active_matters" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_episodic_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_topic_id" text,
	"content" text NOT NULL,
	"embedding" jsonb,
	"importance" real DEFAULT 0.5 NOT NULL,
	"strength_s" real DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_recalled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "memory_migrated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_core_memory" ADD CONSTRAINT "user_core_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_episodic_memories" ADD CONSTRAINT "user_episodic_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_episodic_memories" ADD CONSTRAINT "user_episodic_memories_source_topic_id_topics_id_fk" FOREIGN KEY ("source_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_episodic_memories_user_id_idx" ON "user_episodic_memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_episodic_memories_user_recalled_idx" ON "user_episodic_memories" USING btree ("user_id","last_recalled_at");--> statement-breakpoint
CREATE INDEX "user_episodic_memories_source_topic_id_idx" ON "user_episodic_memories" USING btree ("source_topic_id");--> statement-breakpoint
CREATE INDEX "topics_user_id_memory_migrated_idx" ON "topics" USING btree ("user_id","memory_migrated");