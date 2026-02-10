import { migrate } from "drizzle-orm/node-postgres/migrator";
import { app } from "./app";
import { config } from "./config";
import { db, pool } from "./db";
import { startBoss, stopBoss, registerJobs } from "./jobs";

async function main() {
  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");

  await startBoss();
  await registerJobs();

  const server = app.listen(config.PORT, () => {
    console.log(`Backend listening on port ${config.PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    server.close();
    await stopBoss();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  pool.end();
  process.exit(1);
});
