CREATE TABLE "ai_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"subject" varchar(50) NOT NULL,
	"actor_auth_user_id" varchar(255) NOT NULL,
	"actor_rbac_user_id" uuid,
	"role_codes" text[] NOT NULL,
	"input" jsonb DEFAULT 'null'::jsonb,
	"output" jsonb DEFAULT 'null'::jsonb,
	"request_info" jsonb DEFAULT 'null'::jsonb,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
