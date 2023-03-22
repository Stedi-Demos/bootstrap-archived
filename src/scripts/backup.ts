import { GetGuideCommand, ListGuidesCommand } from "@stedi/sdk-client-guides";
import { ListValuesCommand, ValueOutput } from "@stedi/sdk-client-stash";
import { mkdirSync, writeFileSync } from "fs";
import { guidesClient } from "../lib/clients/guides.js";
import { stashClient } from "../lib/clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";
import { parseGuideId } from "../support/guide.js";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const dirname = process.argv[2] ?? "./backup/";
  const filename = `${dirname}/stash.json`;
  const stash = stashClient();
  const guides = guidesClient();

  mkdirSync(`${dirname}/guides`, { recursive: true });

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

  const { items: allGuides } = await guides.send(new ListGuidesCommand({}));
  for (const guideSummary of allGuides ?? []) {
    const guide = await guides.send(
      new GetGuideCommand({ id: guideSummary.id })
    );

    writeFileSync(
      `${dirname}/guides/${parseGuideId(guide.id!)}.json`,
      JSON.stringify(guide, null, 2)
    );
  }

  console.log(`Backup completed to '${dirname}'`);
})();
