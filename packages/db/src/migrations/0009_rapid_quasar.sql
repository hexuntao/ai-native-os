CREATE TABLE "api_idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(120) NOT NULL,
	"actor_auth_user_id" varchar(255) NOT NULL,
	"actor_rbac_user_id" uuid,
	"idempotency_key" varchar(255) NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"status" varchar(20) NOT NULL,
	"response_payload" jsonb DEFAULT 'null'::jsonb,
	"error_code" varchar(120),
	"error_message" text,
	"error_status" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "api_idempotency_scope_actor_key_uidx" ON "api_idempotency_keys" USING btree ("scope","actor_auth_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "api_idempotency_status_idx" ON "api_idempotency_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "api_idempotency_scope_idx" ON "api_idempotency_keys" USING btree ("scope");