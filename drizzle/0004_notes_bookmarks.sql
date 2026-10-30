CREATE TABLE "bookmark" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"course" text NOT NULL,
	"page_key" text NOT NULL,
	"section_key" text NOT NULL,
	"on" boolean NOT NULL,
	"client_ts" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmark_tenant_id_user_id_course_page_key_section_key_pk" PRIMARY KEY("tenant_id","user_id","course","page_key","section_key")
);
--> statement-breakpoint
CREATE TABLE "note" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"course" text NOT NULL,
	"page_key" text NOT NULL,
	"section_key" text NOT NULL,
	"body" text NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"client_ts" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_tenant_id_user_id_id_pk" PRIMARY KEY("tenant_id","user_id","id")
);
--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_page_idx" ON "note" USING btree ("tenant_id","user_id","course","page_key");