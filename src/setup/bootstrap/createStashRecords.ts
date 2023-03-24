import {
  InboundX12TransactionSummary,
  OutboundX12TransactionSummary,
} from "@stedi/sdk-client-partners";
import { SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "../../lib/clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../../lib/constants.js";
import { requiredEnvVar } from "../../lib/environment.js";
import { saveTransactionSetDestinations } from "../../lib/saveTransactionSetDestinations.js";

export const createSampleStashRecords = async ({
  partnershipId,
  rule850,
  rule855,
}: {
  partnershipId: string;
  rule850: OutboundX12TransactionSummary;
  rule855: InboundX12TransactionSummary;
}) => {
  const sftpBucketName = requiredEnvVar("SFTP_BUCKET_NAME");
  const outboundBucketPath = "trading_partners/ANOTHERMERCH/outbound";

  // outbound 850 from THISISME to ANOTHERMERCH
  await saveTransactionSetDestinations(
    `destinations|${partnershipId}|${rule850.transactionSetIdentifier!}`,
    {
      description: "Purchase Orders sent to ANOTHERMERCH",
      destinations: [
        {
          destination: {
            type: "bucket",
            bucketName: sftpBucketName,
            path: outboundBucketPath,
          },
        },
      ],
    }
  );

  // inbound 855 from ANOTHERMERCH to THISISME
  await saveTransactionSetDestinations(
    `destinations|${partnershipId}|${rule855.transactionSetIdentifier!}`,
    {
      description: "Purchase Order Acknowledgments received from ANOTHERMERCH",
      destinations: [
        {
          destination: {
            type: "webhook",
            url: requiredEnvVar("DESTINATION_WEBHOOK_URL"),
          },
        },
      ],
    }
  );

  // outbound 997s to ANOTHERMERCH
  await saveTransactionSetDestinations(`destinations|${partnershipId}|997`, {
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
  });

  await stashClient().send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `destinations|${partnershipId}|acknowledgments`,
      value: {
        generateFor: ["855"],
      },
    })
  );
};
