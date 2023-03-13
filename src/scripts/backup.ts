import { ListValuesCommand, ValueOutput } from "@stedi/sdk-client-stash";
import { writeFileSync } from "fs";
import { stashClient } from "../lib/clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";

(async () => {
  const filename = process.argv[2] ?? "./backup.json";
  const stash = stashClient();

  const PartnersKeyspsace: ValueOutput[] = [];

  let recordsRemaining = true;
  while (recordsRemaining) {
    const { items, nextPageToken } = await stash.send(
      new ListValuesCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
      })
    );

    if (items === undefined) {
      console.log("Nothing to backup");
      process.exit(1);
    }

    PartnersKeyspsace.push(...items);

    recordsRemaining = nextPageToken !== undefined;
  }

  writeFileSync(filename, JSON.stringify({ PartnersKeyspsace }, null, 2));
  console.log(`Backup completed to '${filename}'`);
})();
