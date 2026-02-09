import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { connections } from "../../db/schema";
import { encrypt, decrypt } from "../../lib/encryption";
import { getProvider } from "../../providers/registry";
import { AppError } from "../../middleware/errorHandler";
import { syncContacts, syncInteractions } from "../sync/sync.service";
import type { ProviderConnection, OAuthTokens } from "../../providers/types";

export function getAuthUrl(providerId: string, userId: string): string {
  const provider = getProvider(providerId);
  if (!provider) throw new AppError(404, `Unknown provider: ${providerId}`);
  return provider.getAuthUrl(userId);
}

export async function handleOAuthCallback(providerId: string, code: string, userId: string) {
  const provider = getProvider(providerId);
  if (!provider) throw new AppError(404, `Unknown provider: ${providerId}`);

  const tokens = await provider.handleCallback(code);
  const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  const [connection] = await db
    .insert(connections)
    .values({
      userId,
      provider: providerId,
      accessTokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: encrypt(tokens.refreshToken),
      tokenExpiresAt,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [connections.userId, connections.provider],
      set: {
        accessTokenEncrypted: encrypt(tokens.accessToken),
        refreshTokenEncrypted: encrypt(tokens.refreshToken),
        tokenExpiresAt,
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning();

  return connection;
}

export async function listConnections(userId: string) {
  const rows = await db
    .select({
      id: connections.id,
      provider: connections.provider,
      status: connections.status,
      tokenExpiresAt: connections.tokenExpiresAt,
      createdAt: connections.createdAt,
      updatedAt: connections.updatedAt,
    })
    .from(connections)
    .where(eq(connections.userId, userId));

  return rows;
}

export async function disconnect(connectionId: string, userId: string) {
  const [row] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.userId, userId)))
    .limit(1);

  if (!row) throw new AppError(404, "Connection not found");

  const provider = getProvider(row.provider);
  if (provider && row.refreshTokenEncrypted) {
    try {
      await provider.revokeTokens(decryptConnection(row));
    } catch {
      // Best-effort revocation; proceed with deletion
    }
  }

  await db.delete(connections).where(eq(connections.id, connectionId));
}

export async function triggerSync(connectionId: string, userId: string) {
  const [row] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.userId, userId)))
    .limit(1);

  if (!row) throw new AppError(404, "Connection not found");

  let conn = decryptConnection(row);

  // Refresh tokens if expiring within 5 minutes
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (conn.tokenExpiresAt && conn.tokenExpiresAt < fiveMinutesFromNow) {
    const provider = getProvider(row.provider);
    if (!provider) throw new AppError(500, `Unknown provider: ${row.provider}`);

    const tokens = await provider.refreshTokens(conn);
    conn = await persistRefreshedTokens(connectionId, tokens, conn);
  }

  await syncContacts(conn);
  await syncInteractions(conn);
}

function decryptConnection(row: typeof connections.$inferSelect): ProviderConnection {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    accessToken: row.accessTokenEncrypted ? decrypt(row.accessTokenEncrypted) : "",
    refreshToken: row.refreshTokenEncrypted ? decrypt(row.refreshTokenEncrypted) : "",
    tokenExpiresAt: row.tokenExpiresAt,
  };
}

async function persistRefreshedTokens(
  connectionId: string,
  tokens: OAuthTokens,
  current: ProviderConnection
): Promise<ProviderConnection> {
  const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  await db
    .update(connections)
    .set({
      accessTokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: encrypt(tokens.refreshToken),
      tokenExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(connections.id, connectionId));

  return {
    ...current,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt,
  };
}
