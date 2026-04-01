CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "ai_knowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"metadata" jsonb NOT NULL,
	"chunk_index" integer NOT NULL,
	"token_count" integer NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_uri" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_knowledge_document_chunk_uidx" ON "ai_knowledge" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "ai_knowledge_document_idx" ON "ai_knowledge" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "ai_knowledge_source_type_idx" ON "ai_knowledge" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "ai_knowledge_embedding_hnsw_idx" ON "ai_knowledge" USING hnsw ("embedding" vector_cosine_ops);
