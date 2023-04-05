import { CoreFileError } from "../../../../lib/types/FileError";

export const sampleFileErrorEvent: CoreFileError = {
  "detail-type": "file.failed",
  source: "stedi.core",
  detail: {
    version: "2023-02-13",
    direction: "RECEIVED",
    fileId: "12345",
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
    },
    input: {
      type: "EDI/X12",
      bucketName: "stedi-default-core-artifacts-217851219840",
      key: "1f1b129a-9b86-04ea-3815-2d0f2b271c19/1746-1746-1.edi",
    },
    errors: ["An error occurred"],
  },
};
