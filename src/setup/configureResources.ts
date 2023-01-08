import dotenv from "dotenv";

import {
  CreateKeyspaceCommand,
  SetValueCommand,
  StashClient,
} from "@stedi/sdk-client-stash";

import {
  DEFAULT_SDK_CLIENT_PROPS,
  PARTNERS_KEYSPACE_NAME,
} from "../lib/constants.js";
import { requiredEnvVar } from "../lib/environment.js";
import { Partnership, PartnershipSchema } from "../lib/types/PartnerRouting.js";
import { ensureGuideExists } from "../support/guide.js";
import { ensureMappingExists } from "../support/mapping.js";

dotenv.config({ override: true });

(async () => {
  const stashClient = new StashClient({
    ...DEFAULT_SDK_CLIENT_PROPS,
    endpoint: "https://stash.us.stedi.com/2022-04-20",
  });

  try {
    await stashClient.send(
      new CreateKeyspaceCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "KeyspaceAlreadyExistsError"
    )
      console.log("Partner profile already exists");
    else throw error;
  }

  try {
    await stashClient.send(
      new CreateKeyspaceCommand({
        keyspaceName: "outbound-control-numbers",
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "KeyspaceAlreadyExistsError"
    )
      console.log("Partner profile already exists");
    else throw error;
  }

  const guide850 = await ensureGuideExists(
    "src/resources/X12/5010/850/guide.json"
  );
  const guide855 = await ensureGuideExists(
    "src/resources/X12/5010/855/guide.json"
  );
  const mapToGuide850 = await ensureMappingExists(
    "src/resources/X12/5010/850/map.json"
  );

  const partnership: Partnership = {
    applicationIds: {
      ANOTHERMERCH: "ANOAPPID",
      THISISME: "MYAPPID",
    },
    transactionSets: [],
  };

  // outbound 850 from THISISME to ANOTHERMERCH
  partnership.transactionSets.push({
    description: "Purchase Orders sent to ANOTHERMERCH",
    guideIds: [guide850],
    destinations: [
      {
        destination: {
          type: "bucket",
          bucketName: requiredEnvVar("SFTP_BUCKET_NAME"),
          path: "trading_partners/ANOTHERMERCH/outbound",
        },
        mappingId: mapToGuide850,
      },
    ],
    receivingPartnerId: "ANOTHERMERCH",
    sendingPartnerId: "THISISME",
    usageIndicatorCode: "T",
  });

  // inbound 855 from ANOTHERMERCH to THISISME
  partnership.transactionSets.push({
    description: "Purchase Order Acknowledgements received from ANOTHERMERCH",
    guideIds: [guide855],
    destinations: [
      {
        destination: {
          type: "webhook",
          url: requiredEnvVar("DESTINATION_WEBHOOK_URL"),
        },
      },
    ],
    receivingPartnerId: "THISISME",
    sendingPartnerId: "ANOTHERMERCH",
    usageIndicatorCode: "T",
  });

  const parseResult = PartnershipSchema.safeParse(partnership);

  if (!parseResult.success) {
    console.error("Invalid partnership", parseResult.error);
    process.exit(1);
  }

  // create the partnership record
  await stashClient.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `partnership|ANOTHERMERCH|THISISME`,
      value: parseResult,
    })
  );
  await stashClient.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `lookup|ISA|14/ANOTHERMERCH`,
      value: {
        partnerId: "ANOTHERMERCH",
      },
    })
  );
  await stashClient.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `lookup|ISA|ZZ/THISISME`,
      value: {
        partnerId: "THISISME",
      },
    })
  );
})();
