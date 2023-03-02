import { SetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../lib/constants.js";
import { requiredEnvVar } from "../../lib/environment.js";
import { PartnershipInput } from "../../lib/types/PartnerRouting.js";

import { savePartnership } from "../../lib/savePartnership.js";
import { stashClient } from "../../lib/clients/stash.js";

type CreateSampleStashRecordsInput = {
  guide850: string;
  guide855: string;
};

export const createSampleStashRecords = async ({
  guide850,
  guide855,
}: CreateSampleStashRecordsInput) => {
  const stash = stashClient();

  const sftpBucketName = requiredEnvVar("SFTP_BUCKET_NAME");
  const outboundBucketPath = "trading_partners/ANOTHERMERCH/outbound";

  const partnership: PartnershipInput = {
    transactionSets: [],
  };

  // outbound 850 from THISISME to ANOTHERMERCH
  partnership.transactionSets.push({
    description: "Purchase Orders sent to ANOTHERMERCH",
    guideId: guide850,
    destinations: [
      {
        destination: {
          type: "bucket",
          bucketName: sftpBucketName,
          path: outboundBucketPath,
        },
      },
    ],
    receivingPartnerId: "another-merchant",
    sendingPartnerId: "this-is-me",
    usageIndicatorCode: "T",
  });

  // inbound 855 from ANOTHERMERCH to THISISME
  partnership.transactionSets.push({
    description: "Purchase Order Acknowledgements received from ANOTHERMERCH",
    guideId: guide855,
    destinations: [
      {
        destination: {
          type: "webhook",
          url: requiredEnvVar("DESTINATION_WEBHOOK_URL"),
        },
      },
    ],
    acknowledgmentConfig: {
      acknowledgmentType: "997",
    },
    receivingPartnerId: "this-is-me",
    sendingPartnerId: "another-merchant",
    usageIndicatorCode: "T",
  });

  // outbound 997s to ANOTHERMERCH
  partnership.transactionSets.push({
    description: "Outbound 997 Acknowledgments",
    destinations: [
      {
        destination: {
          bucketName: requiredEnvVar("SFTP_BUCKET_NAME"),
          path: "trading_partners/ANOTHERMERCH/outbound",
          type: "bucket",
        },
      },
    ],
    transactionSetIdentifier: "997",
    usageIndicatorCode: "T",
  });

  // write to Stash
  await savePartnership("partnership|this-is-me|another-merchant", partnership);

  await stash.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `lookup|ISA|14/ANOTHERMERCH`,
      value: {
        partnerId: "another-merchant",
      },
    })
  );
  await stash.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `lookup|ISA|ZZ/THISISME`,
      value: {
        partnerId: "this-is-me",
      },
    })
  );
};
