CREATE TABLE "entitlement" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"source" text NOT NULL,
	"plan" text,
	"seat_pack_id" text,
	"external_ref" text,
	"note" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_external_ref_unique" UNIQUE("external_ref"),
	CONSTRAINT "entitlement_source_check" CHECK ("entitlement"."source" in ('direct', 'seat', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "seat_pack" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"course" text NOT NULL,
	"org_name" text NOT NULL,
	"seats" integer NOT NULL,
	"access_months" integer NOT NULL,
	"code_hash" text NOT NULL,
	"code_hint" text NOT NULL,
	"redeem_by" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seat_pack_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "seat_pack_seats_check" CHECK ("seat_pack"."seats" > 0)
);
--> statement-breakpoint
CREATE TABLE "tenant_licence" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"base_pence" integer NOT NULL,
	"included_learners" integer NOT NULL,
	"extra_learner_pence" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_licence_status_check" CHECK ("tenant_licence"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_seat_pack_id_seat_pack_id_fk" FOREIGN KEY ("seat_pack_id") REFERENCES "public"."seat_pack"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_pack" ADD CONSTRAINT "seat_pack_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_licence" ADD CONSTRAINT "tenant_licence_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entitlement_lookup_idx" ON "entitlement" USING btree ("tenant_id","user_id","course");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_seat_once" ON "entitlement" USING btree ("seat_pack_id","user_id");