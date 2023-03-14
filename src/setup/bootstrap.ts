import { ensureGuideExists } from "../support/guide.js";
import { createSampleStashRecords } from "./bootstrap/createStashRecords.js";
import { StashStorage } from "../lib/migration/stashStorage.js";
import { migrator } from "../lib/migration/config.js";
import { createProfiles } from "./bootstrap/createProfiles.js";
import { updateResourceMetadata } from "../support/bootstrapMetadata.js";

(async () => {
  const guide850 = await ensureGuideExists(
    "src/resources/X12/5010/850/guide.json"
  );
  const guide855 = await ensureGuideExists(
    "src/resources/X12/5010/855/guide.json"
  );
  const guide997 = await ensureGuideExists(
    "src/resources/X12/5010/997/guide.json"
  );

  await updateResourceMetadata({
    GUIDE_IDS: [guide850.id!, guide855.id!, guide997.id!],
  });
  const { partnershipId, rule850, rule855, rule997 } = await createProfiles({
    guide850,
    guide855,
    guide997,
  });
  await createSampleStashRecords({ partnershipId, rule850, rule855, rule997 });

  // record all migrations as run (as this file always creates the latest state)
  const migrationStore = new StashStorage({});
  const allMigrations = await migrator.migrations({});
  const appliedMigrations = await migrationStore.executed();
  for (const { name } of allMigrations) {
    if (appliedMigrations.includes(name)) continue;
    migrationStore.logMigration({ name });
  }
})();
