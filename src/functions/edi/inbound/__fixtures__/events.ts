import { requiredEnvVar } from "../../../../lib/environment.js";

export const sampleTransactionProcessedEvent = {
  version: "0",
  id: "3d9d5b1b-0e14-99d0-66d2-6736d9c77ede",
  "detail-type": "transaction.processed",
  source: "stedi.engine",
  account: "217851219840",
  time: "2023-03-14T09:47:29Z",
  region: "us-east-1",
  resources: [],
  detail: {
    version: "2023-02-13",
    direction: "RECEIVED",
    metadata: {
      interchange: { controlNumber: "1746", usageIndicatorCode: "T" },
      group: { controlNumber: "1746", release: "005010" },
      processedAt: "2023-03-14T09:47:28.981Z",
    },
    transaction: {
      id: "6b27245f-c761-4946-bb1c-2ec8786c3737",
      controlNumber: "1",
      transactionSetIdentifier: "855",
      ruleId: "01GVDZ7DVSTX4CH79D13H8J3W3",
    },
    input: {
      type: "EDI/X12",
      bucketName: "stedi-default-engine-artifacts-217851219840",
      key: "799573aa-6b53-a29c-9643-5c7e49bd49cd/1746-1746-1.edi",
    },
    output: {
      type: "STEDI/GUIDE-JSON",
      bucketName:
        "default-engine-inbox-json-bfa02b63-0f40-4ea6-a99d-7edb8ed9e86d",
      key: "799573aa-6b53-a29c-9643-5c7e49bd49cd/1746-1746-1.json",
    },
    partnership: {
      partnershipId: "this-is-me_another-merchant",
      sender: {
        isa: { qualifier: "14", id: "ANOTHERMERCH " },
        profileId: "another-merchant",
      },
      receiver: {
        isa: { qualifier: "ZZ", id: "THISISME " },
        profileId: "this-is-me",
      },
    },
  },
};
