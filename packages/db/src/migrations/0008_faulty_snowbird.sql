CREATE TABLE "system_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(120) NOT NULL,
	"scope" varchar(30) NOT NULL,
	"description" varchar(200) NOT NULL,
	"value" varchar(500) NOT NULL,
	"source" varchar(20) DEFAULT 'custom' NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_dict_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dict_id" uuid NOT NULL,
	"label" varchar(80) NOT NULL,
	"value" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_dicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(200),
	"source" varchar(20) DEFAULT 'custom' NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_dict_entries" ADD CONSTRAINT "system_dict_entries_dict_id_system_dicts_id_fk" FOREIGN KEY ("dict_id") REFERENCES "public"."system_dicts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "system_configs_key_uidx" ON "system_configs" USING btree ("key");--> statement-breakpoint
CREATE INDEX "system_configs_scope_idx" ON "system_configs" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "system_configs_status_idx" ON "system_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "system_configs_source_idx" ON "system_configs" USING btree ("source");--> statement-breakpoint
CREATE INDEX "system_dict_entries_dict_id_idx" ON "system_dict_entries" USING btree ("dict_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_dict_entries_dict_id_value_uidx" ON "system_dict_entries" USING btree ("dict_id","value");--> statement-breakpoint
CREATE UNIQUE INDEX "system_dicts_code_uidx" ON "system_dicts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "system_dicts_source_idx" ON "system_dicts" USING btree ("source");--> statement-breakpoint
CREATE INDEX "system_dicts_status_idx" ON "system_dicts" USING btree ("status");