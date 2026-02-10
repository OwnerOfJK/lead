import PgBoss from "pg-boss";
import { eq } from "drizzle-orm";
import { getBoss } from "./boss";
import { handleSyncJob } from "./sync.handler";
import { handleTokenRefresh } from "./token-refresh.handler";
import { db } from "../db";
import { connections } from "../db/schema";

export async function registerJobs(): Promise<void> {
  const boss = getBoss();

  await boss.createQueue("connection-sync", {
    name: "connection-sync",
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 30,
    expireInMinutes: 30,
  });

  await boss.createQueue("token-refresh", {
    name: "token-refresh",
    retryLimit: 2,
    retryBackoff: true,
    retryDelay: 60,
    expireInMinutes: 5,
  });

  await boss.createQueue("connection-sync-scheduler", {
    name: "connection-sync-scheduler",
    retryLimit: 1,
    expireInMinutes: 5,
  });

  await boss.work<{ connectionId: string }>("connection-sync", handleSyncJob);
  await boss.work("token-refresh", handleTokenRefresh);
  await boss.work("connection-sync-scheduler", handleSchedulerJob);

  await boss.schedule("token-refresh", "*/5 * * * *", {});
  await boss.schedule("connection-sync-scheduler", "0 * * * *", {});

  console.log("Job queues registered and schedules set");
}

async function handleSchedulerJob(_jobs: PgBoss.Job[]): Promise<void> {
  const boss = getBoss();

  const activeConnections = await db
    .select({ id: connections.id })
    .from(connections)
    .where(eq(connections.status, "active"));

  console.log(`Scheduler: enqueuing sync for ${activeConnections.length} active connection(s)`);

  for (const conn of activeConnections) {
    await boss.send("connection-sync", { connectionId: conn.id }, {
      singletonKey: conn.id,
    });
  }
}

export { startBoss, stopBoss, getBoss } from "./boss";
