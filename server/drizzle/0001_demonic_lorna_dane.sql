CREATE TYPE "public"."notification_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_plan_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_investment" numeric(20, 8) NOT NULL,
	"expected_return" numeric(10, 4) NOT NULL,
	"duration_days" integer NOT NULL,
	"risk_level" text NOT NULL,
	"category" text,
	"features" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_invested" numeric(20, 8) DEFAULT '0',
	"total_investors" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rate_limit_entries" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_plan_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_amount" numeric(20, 8) NOT NULL,
	"max_amount" numeric(20, 8) NOT NULL,
	"frequency" text NOT NULL,
	"interest_rate" numeric(10, 4) NOT NULL,
	"compounding" text NOT NULL,
	"min_duration_days" integer NOT NULL,
	"max_duration_days" integer NOT NULL,
	"category" text,
	"features" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"user_id" text,
	"ip" text,
	"user_agent" text,
	"endpoint" text,
	"severity" text DEFAULT 'low',
	"details" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_followers" (
	"id" text PRIMARY KEY NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "invested_amount" numeric(20, 8) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD COLUMN "sender_name" varchar;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD COLUMN "sender_role" varchar;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD COLUMN "attachment_name" varchar;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD COLUMN "attachment_size" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "priority" "notification_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_url" varchar(1024);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_label" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "triggered_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "firebase_uid" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "facebook_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "apple_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider" varchar;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_followers" ADD CONSTRAINT "user_followers_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_followers" ADD CONSTRAINT "user_followers_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_unique" ON "friend_requests" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_unique" ON "friendships" USING btree ("user_id","friend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_followers_unique" ON "user_followers" USING btree ("follower_id","following_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_facebook_id_unique" UNIQUE("facebook_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id");