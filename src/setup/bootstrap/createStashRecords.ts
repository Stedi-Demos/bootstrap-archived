import {
  InboundX12TransactionSettingsSummary,
  OutboundX12TransactionSettingsSummary,
} from "@stedi/sdk-client-partners";
import { SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "../../lib/clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../../lib/constants.js";
import { requiredEnvVar } from "../../lib/environment.js";
import { saveErrorDestinations } from "../../lib/saveErrorDestinations.js";
import { saveTransactionSetDestinations } from "../../lib/saveTransactionSetDestinations.js";
import {
  DestinationAck,
  TransactionSetDestinations,
} from "../../lib/types/Destination.js";

export const createSampleStashRecords = async ({
  partnershipId,
  rule850,
  rule855,
}: {
  partnershipId: string;
  rule850: OutboundX12TransactionSettingsSummary;
  rule855: InboundX12TransactionSettingsSummary;
}) => {
  const sftpBucketName = requiredEnvVar("SFTP_BUCKET_NAME");
  const outboundBucketPath = "trading_partners/ANOTHERMERCH/outbound";

  // outbound 850 from THISISME to ANOTHERMERCH
  await saveTransactionSetDestinations(
    `destinations|${partnershipId}|${rule850.transactionSetIdentifier!}`,
    {
      $schema:
        "https://raw.githubusercontent.com/Stedi-Demos/bootstrap/main/src/schemas/transaction-destinations.json",
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
    } satisfies TransactionSetDestinations
  );

  // inbound 855 from ANOTHERMERCH to THISISME
  await saveTransactionSetDestinations(
    `destinations|${partnershipId}|${rule855.transactionSetIdentifier!}`,
    {
      $schema:
        "https://raw.githubusercontent.com/Stedi-Demos/bootstrap/main/src/schemas/transaction-destinations.json",
      description: "Purchase Order Acknowledgments received from ANOTHERMERCH",
      destinations: [
        {
          destination: {
            type: "webhook",
            url: requiredEnvVar("DESTINATION_WEBHOOK_URL"),
          },
        },
      ],
    } satisfies TransactionSetDestinations
  );

  // outbound 997s to ANOTHERMERCH
  await saveTransactionSetDestinations(`destinations|${partnershipId}|997`, {
    $schema:
      "https://raw.githubusercontent.com/Stedi-Demos/bootstrap/main/src/schemas/transaction-destinations.json",
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
  } satisfies TransactionSetDestinations);

  await saveErrorDestinations("destinations|errors|file_error", {
    $schema:
      "https://raw.githubusercontent.com/Stedi-Demos/bootstrap/main/src/schemas/error-destinations.json",
    description: "Send file errors to webhook",
    destinations: [
      {
        destination: {
          type: "webhook",
          url: requiredEnvVar("DESTINATION_WEBHOOK_URL"),
          verb: "POST",
        },
      },
    ],
  });

  await saveErrorDestinations("destinations|errors|execution", {
    $schema:
      "https://raw.githubusercontent.com/Stedi-Demos/bootstrap/main/src/schemas/error-destinations.json",
    description: "Send function execution errors to webhook",
    destinations: [
      {
        destination: {
          type: "webhook",
          url: requiredEnvVar("DESTINATION_WEBHOOK_URL"),
          verb: "POST",
        },
      },
    ],
  });

  await stashClient().send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `functional_acknowledgments|${partnershipId}`,
      value: {
        $schema:
          "https://raw.githubusercontent.com/Stedi-Demos/bootstrap/main/src/schemas/acknowledgment.json",
        generateFor: ["855"],
      } satisfies DestinationAck,
    })
  );
};
