import PgBoss from "pg-boss";
import { lt, eq, and } from "drizzle-orm";
import { db } from "../db";
import { connections } from "../db/schema";
import { getProvider } from "../providers/registry";
import { decryptConnection, persistRefreshedTokens } from "../modules/connections/connections.service";

export async function handleTokenRefresh(_jobs: PgBoss.Job[]): Promise<void> {
  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

  const rows = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.status, "active"),
        lt(connections.tokenExpiresAt, tenMinutesFromNow)
      )
    );

  console.log(`Token refresh: found ${rows.length} connection(s) expiring soon`);

  for (const row of rows) {
    try {
      const provider = getProvider(row.provider);
      if (!provider) {
        console.error(`Token refresh: unknown provider ${row.provider} for connection ${row.id}`);
        continue;
      }
      const conn = decryptConnection(row);
      const tokens = await provider.refreshTokens(conn);
      await persistRefreshedTokens(row.id, tokens, conn);
      console.log(`Token refresh: refreshed connection ${row.id}`);
    } catch (err) {
      console.error(`Token refresh: failed for connection ${row.id}`, err);
    }
  }
}
