CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "connections_user_provider" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "golden_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(50),
	"source_updated_at" timestamp,
	"system_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_map" (
	"golden_record_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	CONSTRAINT "identity_map_golden_record_id_provider_provider_id_pk" PRIMARY KEY("golden_record_id","provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "source_contacts" (
	"connection_id" uuid NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"category" varchar(50),
	"email" varchar(255),
	"phone" varchar(50),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"company_name" varchar(255),
	"job_title" varchar(255),
	"raw" jsonb,
	"source_updated_at" timestamp,
	"system_updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_contacts_connection_id_provider_id_pk" PRIMARY KEY("connection_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "source_interactions" (
	"connection_id" uuid NOT NULL,
	"interaction_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"entity_type" varchar(50),
	"content_text" text,
	"raw" jsonb,
	"source_updated_at" timestamp,
	"system_updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_interactions_connection_id_interaction_id_pk" PRIMARY KEY("connection_id","interaction_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_records" ADD CONSTRAINT "golden_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_map" ADD CONSTRAINT "identity_map_golden_record_id_golden_records_id_fk" FOREIGN KEY ("golden_record_id") REFERENCES "public"."golden_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_contacts" ADD CONSTRAINT "source_contacts_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_interactions" ADD CONSTRAINT "source_interactions_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;