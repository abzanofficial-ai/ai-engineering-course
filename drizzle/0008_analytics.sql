CREATE TABLE "signup_source" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"medium" text DEFAULT '' NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signup_source_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "traffic_daily" (
	"tenant_id" text NOT NULL,
	"day" date NOT NULL,
	"source" text NOT NULL,
	"medium" text DEFAULT '' NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "traffic_daily_tenant_id_day_source_medium_campaign_pk" PRIMARY KEY("tenant_id","day","source","medium","campaign")
);
--> statement-breakpoint
ALTER TABLE "signup_source" ADD CONSTRAINT "signup_source_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_source" ADD CONSTRAINT "signup_source_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_daily" ADD CONSTRAINT "traffic_daily_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;