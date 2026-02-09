import { migrate } from "drizzle-orm/node-postgres/migrator";
import { app } from "./app";
import { config } from "./config";
import { db, pool } from "./db";

async function main() {
  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");

  app.listen(config.PORT, () => {
    console.log(`Backend listening on port ${config.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  pool.end();
  process.exit(1);
});
