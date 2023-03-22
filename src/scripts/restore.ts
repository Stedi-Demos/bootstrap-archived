import { CreateGuideCommand } from "@stedi/sdk-client-guides";
import { SetValueCommand } from "@stedi/sdk-client-stash";
import { existsSync, readdirSync, readFileSync } from "fs";
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

  if (existsSync(dirname) === false) {
    console.error(`No directroy found at path '${dirname}'`);
    process.exit(1);
  }

  if (!existsSync(filename)) {
    console.error(`No file found at path '${filename}'`);
    process.exit(1);
  }

  let stashRaw = readFileSync(filename, "utf-8");

  console.log("Restoring Guides...");
  const guideFiles = readdirSync(`${dirname}/guides`);
  for (const guideFile of guideFiles) {
    const [oldGuidId] = guideFile.split(".");
    const guideRaw = readFileSync(`${dirname}/guides/${guideFile}`, "utf-8");
    const guideBody = JSON.parse(guideRaw);

    try {
      const guide = await guides.send(new CreateGuideCommand(guideBody as any));

      stashRaw = stashRaw.replace(oldGuidId, parseGuideId(guide.id!));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "ResourceConflictException"
      ) {
        console.log("Guide with same name already exists, cancelling restore.");
        process.exit(1);
      } else throw error;
    }
  }

  console.log("Restoring Stash configurations...");
  const stashBackup = JSON.parse(stashRaw);

  for (const item of stashBackup.PartnersKeyspsace) {
    await stash.send(
      new SetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        ...item,
      })
    );
  }
})();
