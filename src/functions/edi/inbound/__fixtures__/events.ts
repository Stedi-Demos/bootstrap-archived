import { TransactionEventSchema } from "../../../../lib/types/TransactionEvent.js";

export const sampleTransactionProcessedEvent = TransactionEventSchema.parse({
  version: "0",
  id: "fedbee6f-f48e-df69-f279-3fbc9fad6305",
  "detail-type": "transaction.processed",
  source: "stedi.core",
  account: "217851219840",
  time: "2023-03-16T14:19:17Z",
  region: "us-east-1",
  resources: [],
  detail: {
    version: "2023-02-13",
    direction: "RECEIVED",
    envelopes: {
      interchange: {
        acknowledgmentRequestedCode: "0",
        controlNumber: 1746,
        date: "220914",
        receiverId: "THISISME ",
        receiverQualifier: "ZZ",
        senderId: "ANOTHERMERCH ",
        senderQualifier: "14",
        time: "2022",
        usageIndicatorCode: "T",
        versionNumberCode: "00501",
      },
      functionalGroup: {
        applicationReceiverCode: "MYAPPID",
        applicationSenderCode: "ANOTAPPID",
        controlNumber: 1746,
        date: "20220914",
        functionalIdentifierCode: "PR",
        release: "005010",
        responsibleAgencyCode: "X",
        time: "202222",
      },
    },
    metadata: { processedAt: "2023-03-16T14:19:17.371Z" },
    transaction: {
      id: "a16254d1-c940-4ba1-b553-b9954f8d3d41",
      controlNumber: 1,
      transactionSetIdentifier: "855",
      ruleId: "01GVGMMD1ZHVCDX472NEM74GCS",
    },
    input: {
      type: "EDI/X12",
      bucketName: "account_id-sftp",
      key: "1f1b129a-9b86-04ea-3815-2d0f2b271c19/1746-1746-1.edi",
    },
    output: {
      type: "STEDI/GUIDE-JSON",
      bucketName:
        "default-core-inbox-json-bfa02b63-0f40-4ea6-a99d-7edb8ed9e86d",
      key: "1f1b129a-9b86-04ea-3815-2d0f2b271c19/1746-1746-1.json",
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
});
