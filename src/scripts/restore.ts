import { SetValueCommand } from "@stedi/sdk-client-stash";
import { existsSync, readFileSync } from "fs";
import { stashClient } from "../lib/clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";

(async () => {
  const filename = process.argv[2] ?? "./backup.json";
  const stash = stashClient();

  if (existsSync(filename) === false) {
    console.error(`No file found at path '${filename}'`);
    process.exit(1);
  }
  const backupRaw = readFileSync(filename, "utf-8");
  const backup = JSON.parse(backupRaw);

  for (const item of backup.PartnersKeyspsace) {
    await stash.send(
      new SetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        ...item,
      })
    );
  }
})();
