import PgBoss from "pg-boss";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { connections } from "../db/schema";
import { getProvider } from "../providers/registry";
import { decryptConnection, persistRefreshedTokens } from "../modules/connections/connections.service";
import { syncContacts, syncInteractions } from "../modules/sync/sync.service";

interface SyncJobData {
  connectionId: string;
}

export async function handleSyncJob(jobs: PgBoss.Job<SyncJobData>[]): Promise<void> {
  const [job] = jobs;
  const { connectionId } = job.data;

  const [row] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
    .limit(1);

  if (!row || row.status !== "active") {
    console.log(`Skipping sync for connection ${connectionId}: not found or inactive`);
    return;
  }

  let conn = decryptConnection(row);

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (conn.tokenExpiresAt && conn.tokenExpiresAt < fiveMinutesFromNow) {
    const provider = getProvider(row.provider);
    if (!provider) throw new Error(`Unknown provider: ${row.provider}`);
    const tokens = await provider.refreshTokens(conn);
    conn = await persistRefreshedTokens(connectionId, tokens, conn);
  }

  await syncContacts(conn);
  await syncInteractions(conn);

  console.log(`Sync completed for connection ${connectionId}`);
}
