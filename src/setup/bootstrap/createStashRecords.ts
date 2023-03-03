import { requiredEnvVar } from "../../lib/environment.js";
import { saveTransactionSetDestinations } from "../../lib/saveDestinations.js";

export const createSampleStashRecords = async () => {
  const sftpBucketName = requiredEnvVar("SFTP_BUCKET_NAME");
  const outboundBucketPath = "trading_partners/ANOTHERMERCH/outbound";

  // outbound 850 from THISISME to ANOTHERMERCH
  await saveTransactionSetDestinations("destinations|todo1", {
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
  });

  // inbound 855 from ANOTHERMERCH to THISISME
  await saveTransactionSetDestinations("destinations|todo2", {
    description: "Purchase Order Acknowledgements received from ANOTHERMERCH",
    destinations: [
      {
        destination: {
          type: "webhook",
          url: requiredEnvVar("DESTINATION_WEBHOOK_URL"),
        },
      },
    ],
  });

  // outbound 997s to ANOTHERMERCH
  await saveTransactionSetDestinations("destinations|todo3", {
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
};
