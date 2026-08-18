CREATE TABLE "community_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_person_id" text NOT NULL,
	"accepted_by_person_id" text,
	"revoked_by_person_id" text,
	"revocation_reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "community_invitations_recipient_email_normalized" CHECK ("community_invitations"."recipient_email" = lower(btrim("community_invitations"."recipient_email")) and length("community_invitations"."recipient_email") > 0),
	CONSTRAINT "community_invitations_status_check" CHECK ("community_invitations"."status" in ('pending', 'accepted', 'revoked', 'expired')),
	CONSTRAINT "community_invitations_terminal_state_check" CHECK (("community_invitations"."status" = 'pending' and "community_invitations"."accepted_at" is null and "community_invitations"."accepted_by_person_id" is null and "community_invitations"."revoked_at" is null and "community_invitations"."revoked_by_person_id" is null and "community_invitations"."revocation_reason" is null)
        or ("community_invitations"."status" = 'accepted' and "community_invitations"."accepted_at" is not null and "community_invitations"."accepted_by_person_id" is not null and "community_invitations"."revoked_at" is null and "community_invitations"."revoked_by_person_id" is null and "community_invitations"."revocation_reason" is null)
        or ("community_invitations"."status" = 'revoked' and "community_invitations"."revoked_at" is not null and "community_invitations"."revoked_by_person_id" is not null and "community_invitations"."accepted_at" is null and "community_invitations"."accepted_by_person_id" is null)
        or ("community_invitations"."status" = 'expired' and "community_invitations"."accepted_at" is null and "community_invitations"."accepted_by_person_id" is null and "community_invitations"."revoked_at" is null and "community_invitations"."revoked_by_person_id" is null and "community_invitations"."revocation_reason" is null)),
	CONSTRAINT "community_invitations_expiration_check" CHECK ("community_invitations"."expires_at" > "community_invitations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "community_membership_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"person_id" text NOT NULL,
	"invitation_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_policy" text NOT NULL,
	"decided_by_person_id" text,
	"decision_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_membership_requests_status_check" CHECK ("community_membership_requests"."status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "community_membership_requests_approval_policy_check" CHECK ("community_membership_requests"."approval_policy" in ('manual', 'automatic')),
	CONSTRAINT "community_membership_requests_terminal_state_check" CHECK (("community_membership_requests"."status" = 'pending' and "community_membership_requests"."decided_at" is null and "community_membership_requests"."decided_by_person_id" is null and "community_membership_requests"."decision_reason" is null and "community_membership_requests"."cancelled_at" is null)
        or ("community_membership_requests"."status" = 'approved' and "community_membership_requests"."decided_at" is not null and "community_membership_requests"."cancelled_at" is null and (("community_membership_requests"."approval_policy" = 'manual' and "community_membership_requests"."decided_by_person_id" is not null) or ("community_membership_requests"."approval_policy" = 'automatic' and "community_membership_requests"."decided_by_person_id" is null)))
        or ("community_membership_requests"."status" = 'rejected' and "community_membership_requests"."decided_at" is not null and "community_membership_requests"."decided_by_person_id" is not null and "community_membership_requests"."cancelled_at" is null)
        or ("community_membership_requests"."status" = 'cancelled' and "community_membership_requests"."cancelled_at" is not null and "community_membership_requests"."decided_at" is null and "community_membership_requests"."decided_by_person_id" is null and "community_membership_requests"."decision_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "community_audit_events" DROP CONSTRAINT "community_audit_events_type_check";--> statement-breakpoint
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_created_by_person_id_people_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_accepted_by_person_id_people_id_fk" FOREIGN KEY ("accepted_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_revoked_by_person_id_people_id_fk" FOREIGN KEY ("revoked_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_membership_requests" ADD CONSTRAINT "community_membership_requests_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_membership_requests" ADD CONSTRAINT "community_membership_requests_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_invitations_id_community_unique" ON "community_invitations" USING btree ("id","community_id");--> statement-breakpoint
ALTER TABLE "community_membership_requests" ADD CONSTRAINT "community_membership_requests_invitation_community_fk" FOREIGN KEY ("invitation_id","community_id") REFERENCES "public"."community_invitations"("id","community_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_membership_requests" ADD CONSTRAINT "community_membership_requests_decided_by_person_id_people_id_fk" FOREIGN KEY ("decided_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_invitations_token_hash_unique" ON "community_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "community_invitations_live_recipient_unique" ON "community_invitations" USING btree ("community_id","recipient_email") WHERE "community_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "community_invitations_community_status_idx" ON "community_invitations" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX "community_invitations_recipient_email_idx" ON "community_invitations" USING btree ("recipient_email");--> statement-breakpoint
CREATE UNIQUE INDEX "community_membership_requests_live_person_unique" ON "community_membership_requests" USING btree ("community_id","person_id") WHERE "community_membership_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "community_membership_requests_invitation_unique" ON "community_membership_requests" USING btree ("invitation_id") WHERE "community_membership_requests"."invitation_id" is not null;--> statement-breakpoint
CREATE INDEX "community_membership_requests_community_status_idx" ON "community_membership_requests" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX "community_membership_requests_person_id_idx" ON "community_membership_requests" USING btree ("person_id");--> statement-breakpoint
ALTER TABLE "community_audit_events" ADD CONSTRAINT "community_audit_events_type_check" CHECK ("community_audit_events"."event_type" in ('community.settings.updated', 'community.archived', 'community.restored', 'community.invitation.created', 'community.invitation.accepted', 'community.invitation.revoked', 'community.invitation.expired', 'community.membership.requested', 'community.membership.approved', 'community.membership.rejected', 'community.membership.cancelled'));
