-- ADR-0023: tenancy-ready data model. Hand-ordered so existing rows are kept:
-- create tenancy tables, insert the default tenant, add tenant_id with a temporary default
-- (backfilling every existing row), then rebuild primary keys and foreign keys.
-- Reverse script: docs/runbook.md ("Rolling back migration 0001").
CREATE TABLE "membership" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'learner' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id"),
	CONSTRAINT "membership_role_check" CHECK ("membership"."role" in ('tenant_admin', 'tutor', 'learner')),
	CONSTRAINT "membership_status_check" CHECK ("membership"."status" in ('active', 'deactivated'))
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tenant_course" (
	"tenant_id" text NOT NULL,
	"course" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"disabled_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "tenant_course_tenant_id_course_pk" PRIMARY KEY("tenant_id","course")
);
--> statement-breakpoint;--> statement-breakpoint
INSERT INTO "tenant" ("id", "slug", "config") VALUES ('tnt_default', 'default', '{}'::jsonb);--> statement-breakpoint
INSERT INTO "tenant_course" ("tenant_id", "course") VALUES ('tnt_default', 'ai-engineering-handbook');--> statement-breakpoint
ALTER TABLE "activity_day" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "activity_day" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "activity_day" DROP CONSTRAINT "activity_day_user_id_day_pk";--> statement-breakpoint
ALTER TABLE "card_review" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "card_review" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "card_review" DROP CONSTRAINT "card_review_user_id_course_card_key_pk";--> statement-breakpoint
ALTER TABLE "drill_answer" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "drill_answer" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "drill_answer" DROP CONSTRAINT "drill_answer_user_id_course_page_key_pk";--> statement-breakpoint
ALTER TABLE "lab_completion" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "lab_completion" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lab_completion" DROP CONSTRAINT "lab_completion_user_id_course_page_key_lab_key_pk";--> statement-breakpoint
ALTER TABLE "lab_step" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "lab_step" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lab_step" DROP CONSTRAINT "lab_step_user_id_course_page_key_lab_key_step_key_pk";--> statement-breakpoint
ALTER TABLE "last_position" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "last_position" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "last_position" DROP CONSTRAINT "last_position_user_id_course_pk";--> statement-breakpoint
ALTER TABLE "section_progress" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "section_progress" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "section_progress" DROP CONSTRAINT "section_progress_user_id_course_page_key_section_key_pk";--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_pkey";--> statement-breakpoint
ALTER TABLE "xp_event" ADD COLUMN "tenant_id" text NOT NULL DEFAULT 'tnt_default';--> statement-breakpoint
ALTER TABLE "xp_event" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "xp_event" DROP CONSTRAINT "xp_event_user_id_course_event_id_pk";--> statement-breakpoint
ALTER TABLE "activity_day" ADD CONSTRAINT "activity_day_tenant_id_user_id_day_pk" PRIMARY KEY("tenant_id","user_id","day");--> statement-breakpoint
ALTER TABLE "card_review" ADD CONSTRAINT "card_review_tenant_id_user_id_course_card_key_pk" PRIMARY KEY("tenant_id","user_id","course","card_key");--> statement-breakpoint
ALTER TABLE "drill_answer" ADD CONSTRAINT "drill_answer_tenant_id_user_id_course_page_key_pk" PRIMARY KEY("tenant_id","user_id","course","page_key");--> statement-breakpoint
ALTER TABLE "lab_completion" ADD CONSTRAINT "lab_completion_tenant_id_user_id_course_page_key_lab_key_pk" PRIMARY KEY("tenant_id","user_id","course","page_key","lab_key");--> statement-breakpoint
ALTER TABLE "lab_step" ADD CONSTRAINT "lab_step_tenant_id_user_id_course_page_key_lab_key_step_key_pk" PRIMARY KEY("tenant_id","user_id","course","page_key","lab_key","step_key");--> statement-breakpoint
ALTER TABLE "last_position" ADD CONSTRAINT "last_position_tenant_id_user_id_course_pk" PRIMARY KEY("tenant_id","user_id","course");--> statement-breakpoint
ALTER TABLE "section_progress" ADD CONSTRAINT "section_progress_tenant_id_user_id_course_page_key_section_key_pk" PRIMARY KEY("tenant_id","user_id","course","page_key","section_key");--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id");--> statement-breakpoint
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_tenant_id_user_id_course_event_id_pk" PRIMARY KEY("tenant_id","user_id","course","event_id");--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "platform_role" text;--> statement-breakpoint
UPDATE "user" SET "platform_role" = 'platform_owner' WHERE "role" = 'admin';--> statement-breakpoint
INSERT INTO "membership" ("tenant_id", "user_id", "role") SELECT 'tnt_default', "id", 'learner' FROM "user";--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_course" ADD CONSTRAINT "tenant_course_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_day" ADD CONSTRAINT "activity_day_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_review" ADD CONSTRAINT "card_review_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_answer" ADD CONSTRAINT "drill_answer_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_completion" ADD CONSTRAINT "lab_completion_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_step" ADD CONSTRAINT "lab_step_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "last_position" ADD CONSTRAINT "last_position_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_progress" ADD CONSTRAINT "section_progress_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;
