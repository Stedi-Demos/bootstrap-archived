import { requiredEnvVar } from "../../../../lib/environment.js";

export const sampleS3Event = (
  key = "trading_partners/ANOTHERMERCH/inbound/inbound.edi"
) => ({
  Records: [
    {
      eventVersion: "2.2",
      eventSource: "aws:s3",
      awsRegion: "us-east-1",
      eventTime: "2021-09-01T19:00:00.000Z",
      eventName: "ObjectCreated:Put",
      userIdentity: {
        principalId: "",
      },
      requestParameters: {
        sourceIPAddress: "",
      },
      responseElements: {
        "x-amz-request-id": "",
        "x-amz-id-2": "",
      },
      s3: {
        s3SchemaVersion: "1.0",
        configurationId: "",
        bucket: {
          name: requiredEnvVar("FTP_BUCKET_NAME"),
          ownerIdentity: {
            principalId: "",
          },
          arn: "",
        },
        object: {
          key,
          size: 1202,
          eTag: "object eTag",

          sequencer: "",
        },
      },
    },
  ],
});
