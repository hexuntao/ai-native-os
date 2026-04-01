CREATE TABLE "ai_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_key" varchar(120) NOT NULL,
	"version" integer NOT NULL,
	"prompt_text" text NOT NULL,
	"notes" text,
	"release_policy" jsonb NOT NULL,
	"eval_evidence" jsonb,
	"status" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_auth_user_id" varchar(255) NOT NULL,
	"created_by_rbac_user_id" uuid,
	"activated_by_auth_user_id" varchar(255),
	"activated_by_rbac_user_id" uuid,
	"activated_at" timestamp,
	"rolled_back_from_version_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_prompt_versions_prompt_key_idx" ON "ai_prompt_versions" USING btree ("prompt_key");--> statement-breakpoint
CREATE INDEX "ai_prompt_versions_status_idx" ON "ai_prompt_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_prompt_versions_active_idx" ON "ai_prompt_versions" USING btree ("prompt_key","is_active");--> statement-breakpoint
CREATE INDEX "ai_prompt_versions_version_idx" ON "ai_prompt_versions" USING btree ("prompt_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompt_versions_prompt_key_version_uidx" ON "ai_prompt_versions" USING btree ("prompt_key","version");