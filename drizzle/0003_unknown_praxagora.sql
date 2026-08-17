CREATE TABLE "communities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"schedule_visibility" text DEFAULT 'members' NOT NULL,
	"membership_approval" text DEFAULT 'manual' NOT NULL,
	"gm_admission" text DEFAULT 'approved_only' NOT NULL,
	"lifecycle_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communities_name_not_blank" CHECK (length(btrim("communities"."name")) > 0),
	CONSTRAINT "communities_slug_format" CHECK ("communities"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "communities_visibility_check" CHECK ("communities"."visibility" in ('private', 'public')),
	CONSTRAINT "communities_schedule_visibility_check" CHECK ("communities"."schedule_visibility" in ('members', 'public')),
	CONSTRAINT "communities_membership_approval_check" CHECK ("communities"."membership_approval" in ('manual', 'automatic')),
	CONSTRAINT "communities_gm_admission_check" CHECK ("communities"."gm_admission" in ('approved_only', 'self_service')),
	CONSTRAINT "communities_lifecycle_status_check" CHECK ("communities"."lifecycle_status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "community_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"person_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_memberships_status_check" CHECK ("community_memberships"."status" in ('pending', 'active', 'suspended', 'left'))
);
--> statement-breakpoint
CREATE TABLE "community_role_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"person_id" text NOT NULL,
	"role" text NOT NULL,
	"granted_by_person_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "community_role_grants_role_check" CHECK ("community_role_grants"."role" in ('owner', 'gm')),
	CONSTRAINT "community_role_grants_revocation_time_check" CHECK ("community_role_grants"."revoked_at" is null or "community_role_grants"."revoked_at" >= "community_role_grants"."granted_at")
);
--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD CONSTRAINT "community_role_grants_granted_by_person_id_people_id_fk" FOREIGN KEY ("granted_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communities_slug_unique" ON "communities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "community_memberships_community_person_unique" ON "community_memberships" USING btree ("community_id","person_id");--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD CONSTRAINT "community_role_grants_membership_fk" FOREIGN KEY ("community_id","person_id") REFERENCES "public"."community_memberships"("community_id","person_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_memberships_person_id_idx" ON "community_memberships" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_role_grants_active_role_unique" ON "community_role_grants" USING btree ("community_id","person_id","role") WHERE "community_role_grants"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "community_role_grants_person_id_idx" ON "community_role_grants" USING btree ("person_id");
