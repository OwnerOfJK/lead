import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import {
  sourceContacts,
  sourceInteractions,
  goldenRecords,
  identityMap,
  connections,
} from "../../db/schema";
import { getProvider } from "../../providers/registry";
import type { ProviderConnection, SourceContact, SourceInteraction } from "../../providers/types";

export async function syncContacts(connection: ProviderConnection) {
  const provider = getProvider(connection.provider);
  if (!provider) throw new Error(`Unknown provider: ${connection.provider}`);

  const rawContacts = await provider.fetchContacts(connection);

  const conn = await db
    .select({ userId: connections.userId })
    .from(connections)
    .where(eq(connections.id, connection.id))
    .limit(1);
  const userId = conn[0]?.userId;
  if (!userId) throw new Error("Connection not found");

  for (const raw of rawContacts) {
    const normalized = provider.normalizeContact(raw);
    await upsertSourceContact(connection.id, normalized);
    await matchOrCreateGoldenRecord(userId, connection.provider, normalized);
  }
}

export async function syncInteractions(connection: ProviderConnection) {
  const provider = getProvider(connection.provider);
  if (!provider) throw new Error(`Unknown provider: ${connection.provider}`);

  const rawInteractions = await provider.fetchInteractions(connection);

  for (const raw of rawInteractions) {
    const normalized = provider.normalizeInteraction(raw);
    await upsertSourceInteraction(connection.id, normalized);
  }
}

async function upsertSourceContact(connectionId: string, contact: SourceContact) {
  await db
    .insert(sourceContacts)
    .values({
      connectionId,
      providerId: contact.providerId,
      provider: contact.provider,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      companyName: contact.companyName,
      jobTitle: contact.jobTitle,
      raw: contact.raw,
      sourceUpdatedAt: contact.sourceUpdatedAt,
      systemUpdatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [sourceContacts.connectionId, sourceContacts.providerId],
      set: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        companyName: contact.companyName,
        jobTitle: contact.jobTitle,
        raw: contact.raw,
        sourceUpdatedAt: contact.sourceUpdatedAt,
        systemUpdatedAt: new Date(),
      },
    });
}

async function upsertSourceInteraction(connectionId: string, interaction: SourceInteraction) {
  await db
    .insert(sourceInteractions)
    .values({
      connectionId,
      interactionId: interaction.interactionId,
      providerId: interaction.providerId,
      entityType: interaction.entityType,
      contentText: interaction.contentText,
      raw: interaction.raw,
      sourceUpdatedAt: interaction.sourceUpdatedAt,
      systemUpdatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [sourceInteractions.connectionId, sourceInteractions.interactionId],
      set: {
        providerId: interaction.providerId,
        entityType: interaction.entityType,
        contentText: interaction.contentText,
        raw: interaction.raw,
        sourceUpdatedAt: interaction.sourceUpdatedAt,
        systemUpdatedAt: new Date(),
      },
    });
}

async function matchOrCreateGoldenRecord(
  userId: string,
  provider: string,
  contact: SourceContact
) {
  // 1. Check identity_map for existing mapping
  const existingMapping = await db
    .select({ goldenRecordId: identityMap.goldenRecordId })
    .from(identityMap)
    .where(
      and(
        eq(identityMap.provider, provider),
        eq(identityMap.providerId, contact.providerId)
      )
    )
    .limit(1);

  if (existingMapping.length > 0) {
    await updateGoldenRecordIfNewer(existingMapping[0].goldenRecordId, contact);
    return;
  }

  // 2. Check for email match within same user
  if (contact.email) {
    const emailMatch = await db
      .select({ id: goldenRecords.id })
      .from(goldenRecords)
      .where(
        and(
          eq(goldenRecords.userId, userId),
          eq(goldenRecords.email, contact.email)
        )
      )
      .limit(1);

    if (emailMatch.length > 0) {
      await db.insert(identityMap).values({
        goldenRecordId: emailMatch[0].id,
        provider,
        providerId: contact.providerId,
      });
      await updateGoldenRecordIfNewer(emailMatch[0].id, contact);
      return;
    }
  }

  // 3. Create new golden record + identity_map entry
  const [newRecord] = await db
    .insert(goldenRecords)
    .values({
      userId,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      sourceUpdatedAt: contact.sourceUpdatedAt,
      systemUpdatedAt: new Date(),
    })
    .returning();

  await db.insert(identityMap).values({
    goldenRecordId: newRecord.id,
    provider,
    providerId: contact.providerId,
  });
}

async function updateGoldenRecordIfNewer(goldenRecordId: string, contact: SourceContact) {
  const [existing] = await db
    .select({ sourceUpdatedAt: goldenRecords.sourceUpdatedAt })
    .from(goldenRecords)
    .where(eq(goldenRecords.id, goldenRecordId))
    .limit(1);

  if (!existing) return;

  const incomingTime = contact.sourceUpdatedAt?.getTime() ?? 0;
  const currentTime = existing.sourceUpdatedAt?.getTime() ?? 0;

  if (incomingTime < currentTime) return;

  const updates: Record<string, unknown> = { systemUpdatedAt: new Date() };
  if (contact.sourceUpdatedAt) updates.sourceUpdatedAt = contact.sourceUpdatedAt;
  if (contact.email) updates.email = contact.email;
  if (contact.firstName) updates.firstName = contact.firstName;
  if (contact.lastName) updates.lastName = contact.lastName;
  if (contact.phone) updates.phone = contact.phone;

  await db.update(goldenRecords).set(updates).where(eq(goldenRecords.id, goldenRecordId));
}
