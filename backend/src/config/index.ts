import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "Must be 64 hex characters (32 bytes)"),
  HUBSPOT_CLIENT_ID: z.string().min(1),
  HUBSPOT_CLIENT_SECRET: z.string().min(1),
  HUBSPOT_REDIRECT_URI: z.string().url(),
  PIPEDRIVE_CLIENT_ID: z.string().min(1),
  PIPEDRIVE_CLIENT_SECRET: z.string().min(1),
  PIPEDRIVE_REDIRECT_URI: z.string().url(),
  ZENDESK_CLIENT_ID: z.string().min(1),
  ZENDESK_CLIENT_SECRET: z.string().min(1),
  ZENDESK_REDIRECT_URI: z.string().url(),
  ZENDESK_SUBDOMAIN: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
