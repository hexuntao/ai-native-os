CREATE TABLE "ai_eval_run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"dataset_item_id" varchar(255) NOT NULL,
	"item_index" integer NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"ground_truth" jsonb,
	"error_message" text,
	"scores" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eval_key" varchar(120) NOT NULL,
	"eval_name" varchar(200) NOT NULL,
	"dataset_id" varchar(255) NOT NULL,
	"dataset_name" varchar(255) NOT NULL,
	"experiment_id" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"trigger_source" varchar(20) NOT NULL,
	"score_average" real,
	"score_min" real,
	"score_max" real,
	"scorer_summary" jsonb NOT NULL,
	"total_items" integer NOT NULL,
	"succeeded_count" integer NOT NULL,
	"failed_count" integer NOT NULL,
	"skipped_count" integer NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"request_id" varchar(255),
	"actor_auth_user_id" varchar(255) NOT NULL,
	"actor_rbac_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_eval_run_items" ADD CONSTRAINT "ai_eval_run_items_run_id_ai_eval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_eval_run_items_run_id_idx" ON "ai_eval_run_items" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_eval_run_items_run_item_uidx" ON "ai_eval_run_items" USING btree ("run_id","dataset_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_eval_runs_experiment_uidx" ON "ai_eval_runs" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "ai_eval_runs_eval_key_idx" ON "ai_eval_runs" USING btree ("eval_key");--> statement-breakpoint
CREATE INDEX "ai_eval_runs_created_at_idx" ON "ai_eval_runs" USING btree ("created_at");