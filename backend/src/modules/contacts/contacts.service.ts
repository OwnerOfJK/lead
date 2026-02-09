import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  goldenRecords,
  identityMap,
  sourceContacts,
  sourceInteractions,
  connections,
} from "../../db/schema";
import { AppError } from "../../middleware/errorHandler";

export async function listGoldenRecords(userId: string) {
  return db
    .select()
    .from(goldenRecords)
    .where(eq(goldenRecords.userId, userId));
}

export async function getGoldenRecordWithSources(id: string, userId: string) {
  const [record] = await db
    .select()
    .from(goldenRecords)
    .where(and(eq(goldenRecords.id, id), eq(goldenRecords.userId, userId)))
    .limit(1);

  if (!record) throw new AppError(404, "Contact not found");

  const mappings = await db
    .select()
    .from(identityMap)
    .where(eq(identityMap.goldenRecordId, id));

  if (mappings.length === 0) {
    return { ...record, sources: [], interactions: [] };
  }

  // Get connection IDs for this user to scope source queries
  const userConnections = await db
    .select({ id: connections.id })
    .from(connections)
    .where(eq(connections.userId, userId));
  const connectionIds = userConnections.map((c) => c.id);

  if (connectionIds.length === 0) {
    return { ...record, sources: [], interactions: [] };
  }

  const providerIds = mappings.map((m) => m.providerId);

  const sources = await db
    .select()
    .from(sourceContacts)
    .where(
      and(
        inArray(sourceContacts.connectionId, connectionIds),
        inArray(sourceContacts.providerId, providerIds)
      )
    );

  const interactions = await db
    .select()
    .from(sourceInteractions)
    .where(
      and(
        inArray(sourceInteractions.connectionId, connectionIds),
        inArray(sourceInteractions.providerId, providerIds)
      )
    );

  return { ...record, sources, interactions };
}
