import { migrator } from "../lib/migration/config.js";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  console.log("Migrating Bootstrap...");

  const migrations = await migrator.up();

  if (migrations.length === 0) {
    console.log("Bootstrap is already up-to-date");
  } else {
    console.log("The following migrations were applied successfully:");
    console.dir(migrations, { depth: null });
  }
})();
