import { GetObjectCommand } from "@stedi/sdk-client-buckets";
import * as x12Tools from "@stedi/x12-tools";
import { bucketsClient } from "./clients/buckets.js";

export const getSourceTransactionSet = async (detail: {
  envelopes: {
    interchange: { controlNumber: number };
    functionalGroup: { controlNumber: number };
  };
  transaction: { controlNumber: number };
  input: {
    bucketName: string;
    key: string;
  };
}) => {
  const getSourceResponse = await bucketsClient().send(
    new GetObjectCommand({
      bucketName: detail.input.bucketName,
      key: detail.input.key,
    })
  );
  const sourceFile = await getSourceResponse.body?.transformToString();

  const source = extractTransactionSetFromEdi(
    sourceFile ?? "",
    detail.envelopes.interchange.controlNumber,
    detail.envelopes.functionalGroup.controlNumber,
    detail.transaction.controlNumber
  );

  return source;
};

const extractTransactionSetFromEdi = (
  edi: string,
  isaId: number,
  gsId: number,
  txnId: number
) => {
  const meta = x12Tools.metadata(edi);
  const interchange = meta.interchanges.find(
    (i) => i.envelope?.controlNumber === isaId
  );
  const group = interchange?.functionalGroups.find(
    (fg) => fg.envelope?.controlNumber === gsId
  );
  const txn = group?.transactionSets.find((ts) => ts.controlNumber === txnId);
  const segmentDelimiter = interchange?.delimiters?.segment ?? "~";

  if (interchange && group && txn) {
    const txnEdi = edi.slice(txn.span.start, txn.span.end + 1);
    const gsEdi =
      edi.slice(group.span.start).split(segmentDelimiter)[0]! +
      segmentDelimiter;
    const geEdi =
      edi.slice(0, group.span.end).split(segmentDelimiter).at(-1)! +
      segmentDelimiter;
    const isaEdi =
      edi.slice(interchange.span.start).split(segmentDelimiter)[0]! +
      segmentDelimiter;
    const ieaEdi =
      edi.slice(0, interchange.span.end).split(segmentDelimiter).at(-1)! +
      segmentDelimiter;
    return isaEdi + gsEdi + txnEdi + geEdi + ieaEdi;
  }

  return "";
};
