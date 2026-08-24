CREATE TABLE "community_gm_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"person_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admission_policy" text NOT NULL,
	"decided_by_person_id" text,
	"decision_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_gm_requests_status_check" CHECK ("community_gm_requests"."status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "community_gm_requests_admission_policy_check" CHECK ("community_gm_requests"."admission_policy" in ('approved_only', 'self_service')),
	CONSTRAINT "community_gm_requests_decision_reason_length_check" CHECK ("community_gm_requests"."decision_reason" is null or length("community_gm_requests"."decision_reason") <= 500),
	CONSTRAINT "community_gm_requests_terminal_state_check" CHECK (("community_gm_requests"."status" = 'pending' and "community_gm_requests"."decided_at" is null and "community_gm_requests"."decided_by_person_id" is null and "community_gm_requests"."decision_reason" is null and "community_gm_requests"."cancelled_at" is null)
        or ("community_gm_requests"."status" = 'approved' and "community_gm_requests"."decided_at" is not null and "community_gm_requests"."cancelled_at" is null and (("community_gm_requests"."admission_policy" = 'approved_only' and "community_gm_requests"."decided_by_person_id" is not null) or ("community_gm_requests"."admission_policy" = 'self_service' and "community_gm_requests"."decided_by_person_id" is null)))
        or ("community_gm_requests"."status" = 'rejected' and "community_gm_requests"."decided_at" is not null and "community_gm_requests"."decided_by_person_id" is not null and "community_gm_requests"."cancelled_at" is null)
        or ("community_gm_requests"."status" = 'cancelled' and "community_gm_requests"."cancelled_at" is not null and "community_gm_requests"."decided_at" is null and "community_gm_requests"."decided_by_person_id" is null and "community_gm_requests"."decision_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "community_audit_events" DROP CONSTRAINT "community_audit_events_type_check";--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD COLUMN "revoked_by_person_id" text;--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD COLUMN "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "community_role_grants"
SET "status" = 'revoked',
    "revocation_reason" = 'Legacy revocation: actor unavailable',
    "updated_at" = COALESCE("revoked_at", now())
WHERE "role" = 'gm' AND "revoked_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "community_gm_requests" ADD CONSTRAINT "community_gm_requests_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_gm_requests" ADD CONSTRAINT "community_gm_requests_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_gm_requests" ADD CONSTRAINT "community_gm_requests_decided_by_person_id_people_id_fk" FOREIGN KEY ("decided_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_gm_requests_live_person_unique" ON "community_gm_requests" USING btree ("community_id","person_id") WHERE "community_gm_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "community_gm_requests_community_status_idx" ON "community_gm_requests" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX "community_gm_requests_person_id_idx" ON "community_gm_requests" USING btree ("person_id");--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD CONSTRAINT "community_role_grants_revoked_by_person_id_people_id_fk" FOREIGN KEY ("revoked_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_audit_events" ADD CONSTRAINT "community_audit_events_type_check" CHECK ("community_audit_events"."event_type" in ('community.settings.updated', 'community.archived', 'community.restored', 'community.invitation.created', 'community.invitation.accepted', 'community.invitation.revoked', 'community.invitation.expired', 'community.membership.requested', 'community.membership.approved', 'community.membership.rejected', 'community.membership.cancelled', 'community.gm.requested', 'community.gm.approved', 'community.gm.rejected', 'community.gm.cancelled', 'community.gm.revoked', 'community.gm.self_service_promoted'));--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD CONSTRAINT "community_role_grants_status_check" CHECK ("community_role_grants"."status" in ('active', 'revoked'));--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD CONSTRAINT "community_role_grants_reason_length_check" CHECK ("community_role_grants"."revocation_reason" is null or length("community_role_grants"."revocation_reason") <= 500);--> statement-breakpoint
ALTER TABLE "community_role_grants" ADD CONSTRAINT "community_role_grants_lifecycle_check" CHECK (("community_role_grants"."role" = 'owner' and "community_role_grants"."status" = 'active' and "community_role_grants"."revoked_by_person_id" is null and "community_role_grants"."revocation_reason" is null)
        or ("community_role_grants"."role" = 'gm' and "community_role_grants"."status" = 'active' and "community_role_grants"."revoked_at" is null and "community_role_grants"."revoked_by_person_id" is null and "community_role_grants"."revocation_reason" is null)
        or ("community_role_grants"."role" = 'gm' and "community_role_grants"."status" = 'revoked' and "community_role_grants"."revoked_at" is not null and ("community_role_grants"."revoked_by_person_id" is not null or ("community_role_grants"."revoked_by_person_id" is null and "community_role_grants"."revocation_reason" = 'Legacy revocation: actor unavailable'))));
