import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("connections_user_provider").on(table.userId, table.provider)]
);

export const goldenRecords = pgTable("golden_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  sourceUpdatedAt: timestamp("source_updated_at"),
  systemUpdatedAt: timestamp("system_updated_at").defaultNow().notNull(),
});

export const sourceContacts = pgTable(
  "source_contacts",
  {
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    category: varchar("category", { length: 50 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    companyName: varchar("company_name", { length: 255 }),
    jobTitle: varchar("job_title", { length: 255 }),
    raw: jsonb("raw"),
    sourceUpdatedAt: timestamp("source_updated_at"),
    systemUpdatedAt: timestamp("system_updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.connectionId, table.providerId] })]
);

export const sourceInteractions = pgTable(
  "source_interactions",
  {
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    interactionId: varchar("interaction_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    contentText: text("content_text"),
    raw: jsonb("raw"),
    sourceUpdatedAt: timestamp("source_updated_at"),
    systemUpdatedAt: timestamp("system_updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.connectionId, table.interactionId] })]
);

export const identityMap = pgTable(
  "identity_map",
  {
    goldenRecordId: uuid("golden_record_id")
      .notNull()
      .references(() => goldenRecords.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.goldenRecordId, table.provider, table.providerId] }),
  ]
);
