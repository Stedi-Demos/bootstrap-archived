import { EngineFunctionalGroupTranslationSucceededEvent } from "../types.js";

export const sampleTranslationSucceededEvent: EngineFunctionalGroupTranslationSucceededEvent =
  {
    "detail-type": "functional_group.processed",
    source: "stedi.core",
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
          functionalIdentifierCode: "PO",
          release: "005010",
          responsibleAgencyCode: "X",
          time: "202222",
        },
      },
      input: {
        type: "EDI/X12",
        bucketName: "stedi-default-engine-artifacts-217851219840",
        key: "1f1b129a-9b86-04ea-3815-2d0f2b271c19/1746-1746-1.edi",
      },
      transactionSetIds: ["850"],
      transactionSetCount: 1,
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
