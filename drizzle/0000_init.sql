CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_day" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "activity_day_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "card_review" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"card_key" text NOT NULL,
	"page_key" text NOT NULL,
	"rating" text NOT NULL,
	"box" integer NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"client_ts" bigint NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_review_user_id_course_card_key_pk" PRIMARY KEY("user_id","course","card_key")
);
--> statement-breakpoint
CREATE TABLE "drill_answer" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"page_key" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"revealed" boolean DEFAULT false NOT NULL,
	"client_ts" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drill_answer_user_id_course_page_key_pk" PRIMARY KEY("user_id","course","page_key")
);
--> statement-breakpoint
CREATE TABLE "lab_completion" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"page_key" text NOT NULL,
	"lab_key" text NOT NULL,
	"committed" boolean NOT NULL,
	"client_ts" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_completion_user_id_course_page_key_lab_key_pk" PRIMARY KEY("user_id","course","page_key","lab_key")
);
--> statement-breakpoint
CREATE TABLE "lab_step" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"page_key" text NOT NULL,
	"lab_key" text NOT NULL,
	"step_key" text NOT NULL,
	"done" boolean NOT NULL,
	"client_ts" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_step_user_id_course_page_key_lab_key_step_key_pk" PRIMARY KEY("user_id","course","page_key","lab_key","step_key")
);
--> statement-breakpoint
CREATE TABLE "last_position" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"page_key" text NOT NULL,
	"mode" text NOT NULL,
	"section_index" integer DEFAULT 0 NOT NULL,
	"client_ts" bigint NOT NULL,
	CONSTRAINT "last_position_user_id_course_pk" PRIMARY KEY("user_id","course")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_bucket" (
	"key" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limit_bucket_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "section_progress" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"page_key" text NOT NULL,
	"section_key" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_progress_user_id_course_page_key_section_key_pk" PRIMARY KEY("user_id","course","page_key","section_key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'learner',
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"weekly_goal" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_event" (
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"event_id" text NOT NULL,
	"points" integer NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_event_user_id_course_event_id_pk" PRIMARY KEY("user_id","course","event_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_day" ADD CONSTRAINT "activity_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_review" ADD CONSTRAINT "card_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_answer" ADD CONSTRAINT "drill_answer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_completion" ADD CONSTRAINT "lab_completion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_step" ADD CONSTRAINT "lab_step_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "last_position" ADD CONSTRAINT "last_position_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_progress" ADD CONSTRAINT "section_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "card_review_due_idx" ON "card_review" USING btree ("user_id","course","due_at");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "xp_event_recent_idx" ON "xp_event" USING btree ("user_id","course","created_at");