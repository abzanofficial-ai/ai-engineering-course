CREATE TABLE "checkpoint_attempt" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"part" integer NOT NULL,
	"attempt" integer NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkpoint_attempt_tenant_id_user_id_course_part_attempt_pk" PRIMARY KEY("tenant_id","user_id","course","part","attempt")
);
--> statement-breakpoint
ALTER TABLE "checkpoint_attempt" ADD CONSTRAINT "checkpoint_attempt_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoint_attempt" ADD CONSTRAINT "checkpoint_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;