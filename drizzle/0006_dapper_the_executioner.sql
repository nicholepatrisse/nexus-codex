ALTER TABLE "community_invitations" DROP CONSTRAINT "community_invitations_recipient_email_normalized";--> statement-breakpoint
ALTER TABLE "community_invitations" DROP CONSTRAINT "community_invitations_status_check";--> statement-breakpoint
ALTER TABLE "community_invitations" DROP CONSTRAINT "community_invitations_terminal_state_check";--> statement-breakpoint
ALTER TABLE "community_invitations" DROP CONSTRAINT "community_invitations_accepted_by_person_id_people_id_fk";
--> statement-breakpoint
DROP INDEX "community_invitations_live_recipient_unique";--> statement-breakpoint
DROP INDEX "community_invitations_recipient_email_idx";--> statement-breakpoint
DROP INDEX "community_membership_requests_invitation_unique";--> statement-breakpoint
ALTER TABLE "community_invitations" ADD COLUMN "max_uses" integer;--> statement-breakpoint
ALTER TABLE "community_invitations" ADD COLUMN "use_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "community_invitations"
SET "max_uses" = 1,
    "use_count" = CASE WHEN "status" = 'accepted' THEN 1 ELSE 0 END,
    "status" = CASE WHEN "status" = 'accepted' THEN 'exhausted' ELSE "status" END;--> statement-breakpoint
CREATE UNIQUE INDEX "community_membership_requests_invitation_person_unique" ON "community_membership_requests" USING btree ("invitation_id","person_id") WHERE "community_membership_requests"."invitation_id" is not null;--> statement-breakpoint
ALTER TABLE "community_invitations" DROP COLUMN "recipient_email";--> statement-breakpoint
ALTER TABLE "community_invitations" DROP COLUMN "accepted_by_person_id";--> statement-breakpoint
ALTER TABLE "community_invitations" DROP COLUMN "accepted_at";--> statement-breakpoint
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_max_uses_check" CHECK ("community_invitations"."max_uses" is null or "community_invitations"."max_uses" >= 1);--> statement-breakpoint
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_use_count_check" CHECK ("community_invitations"."use_count" >= 0 and ("community_invitations"."max_uses" is null or "community_invitations"."use_count" <= "community_invitations"."max_uses"));--> statement-breakpoint
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_status_check" CHECK ("community_invitations"."status" in ('pending', 'exhausted', 'revoked', 'expired'));--> statement-breakpoint
ALTER TABLE "community_invitations" ADD CONSTRAINT "community_invitations_terminal_state_check" CHECK (("community_invitations"."status" = 'pending' and ("community_invitations"."max_uses" is null or "community_invitations"."use_count" < "community_invitations"."max_uses") and "community_invitations"."revoked_at" is null and "community_invitations"."revoked_by_person_id" is null and "community_invitations"."revocation_reason" is null)
        or ("community_invitations"."status" = 'exhausted' and "community_invitations"."max_uses" is not null and "community_invitations"."use_count" = "community_invitations"."max_uses" and "community_invitations"."revoked_at" is null and "community_invitations"."revoked_by_person_id" is null and "community_invitations"."revocation_reason" is null)
        or ("community_invitations"."status" = 'revoked' and "community_invitations"."revoked_at" is not null and "community_invitations"."revoked_by_person_id" is not null)
        or ("community_invitations"."status" = 'expired' and "community_invitations"."revoked_at" is null and "community_invitations"."revoked_by_person_id" is null and "community_invitations"."revocation_reason" is null));
