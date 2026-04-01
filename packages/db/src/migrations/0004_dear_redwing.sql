CREATE TABLE "ai_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_log_id" uuid NOT NULL,
	"actor_auth_user_id" varchar(255) NOT NULL,
	"actor_rbac_user_id" uuid,
	"user_action" varchar(20) NOT NULL,
	"accepted" boolean NOT NULL,
	"correction" text,
	"feedback_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_audit_logs" ADD COLUMN "human_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_audit_log_id_ai_audit_logs_id_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."ai_audit_logs"("id") ON DELETE cascade ON UPDATE no action;