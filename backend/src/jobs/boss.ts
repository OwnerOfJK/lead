import PgBoss from "pg-boss";
import { config } from "../config";

let boss: PgBoss | null = null;

export function getBoss(): PgBoss {
  if (!boss) throw new Error("pg-boss not initialized — call startBoss() first");
  return boss;
}

export async function startBoss(): Promise<PgBoss> {
  boss = new PgBoss({ connectionString: config.DATABASE_URL });
  await boss.start();
  console.log("pg-boss started");
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    console.log("pg-boss stopped");
    boss = null;
  }
}
