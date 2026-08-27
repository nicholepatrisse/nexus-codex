ALTER TABLE "communities" ADD COLUMN "event_name" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "event_code" text;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_event_name_length_check" CHECK ("communities"."event_name" is null or length(btrim("communities"."event_name")) between 1 and 200);--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_event_code_length_check" CHECK ("communities"."event_code" is null or length(btrim("communities"."event_code")) between 1 and 100);