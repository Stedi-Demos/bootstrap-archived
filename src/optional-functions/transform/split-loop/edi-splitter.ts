import { ErrorWithContext } from "../../../lib/errorWithContext.js";

export interface EdiMetadata {
  setsFound: string[];
  interchanges: number;
  isaControlNumbers: string[];
  groups: number;
  gsControlNumbers: string[];
  transactions: number;
  stControlNumbers: string[];
}

// split edi file by transaction set preserving ISA and GS headers
// ISA -- GS -- ST850 -- SE -- ST850 -- SE -- ST977 -- SE -- GE -- IEA split into array
// { "850", ISA -- GS -- ST850 -- GE -- IEA },
// { "850", ISA -- GS -- ST850 -- GE -- IEA },
// { "977", ISA -- GS -- ST977 -- GE -- IEA }

export const ediSplitter = (
  edi: string,
  splitSegments?: { start: string; end: string[] },
  chunkSize?: number,
  transactionSetId?: string
) => {
  // extract delimiters
  const { elementDelimiter, segmentDelimiter } = extractDelimiters(edi);

  let isa = "";
  let gs = "";
  let ge = "";
  let code: string | undefined = "";
  // "code": ["st data se", "st data se"]
  const workingTxns = new Map<string, string[]>();
  const workingGroups = new Map<string, string[]>();
  const splitTransactions: string[] = [];

  const re = new RegExp(
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `(?:(\\w+)${escapeRegExp(elementDelimiter)}(?:.*?)${escapeRegExp(
      segmentDelimiter
    )})+?`,
    "gms"
  );

  for (const match of edi.matchAll(re)) {
    switch (match[1]) {
      case "ISA":
        isa = match[0];
        break;
      case "GS":
        {
          gs = match[0];
          const control = gs.split(elementDelimiter)[6];
          if (!control) {
            throw new ErrorWithContext(
              "Invalid GS segment, missing control number",
              { GS: gs }
            );
          }
        }
        break;
      case "ST":
        {
          code = match[0].split(elementDelimiter)[1];
          const control = match[0].split(elementDelimiter)[2];
          if (!control || !code) {
            throw new ErrorWithContext("Invalid ST segment", { ST: match[0] });
          }

          if (!transactionSetId || transactionSetId === code) {
            // for the txn id, add an item to the array with the gs + st
            workingTxns.set(
              code,
              (workingTxns.get(code) ?? []).concat([gs + match[0]])
            );
          }
        }
        break;
      case "GE":
        ge = match[0];
        workingTxns.forEach((seg, code) => {
          workingTxns.set(
            code,
            // for each txn in the group, append the ge
            seg.map((s) => s + ge)
          );
        });
        const group = workingGroups.get(code) ?? [];
        if (!workingGroups.get(code)) {
          workingGroups.set(code, group);
        }
        group.push(...[...workingTxns.values()].flat());
        workingTxns.clear();
        break;
      case "IEA":
        workingGroups.forEach((txn) => {
          // for each txn, push to the split the isa + txn (which is gs + st + data + se + ge) + iea
          txn.forEach((seg) => splitTransactions.push(isa + seg + match[0]));
        });
        workingGroups.clear();
        break;
      default: {
        if (!transactionSetId || transactionSetId === code) {
          const txnType = workingTxns.get(code);
          // data segment, find latest txn for code
          const txn = txnType?.at(-1);
          // replace last txn with txn + data segment
          txnType?.splice(txnType.length - 1, 1, (txn ?? "") + match[0]);

          if (match[1] === "SE" && code === transactionSetId && splitSegments) {
            const split = splitSingleTransaction(
              (txn ?? "") + match[0],
              splitSegments,
              { elementDelimiter, segmentDelimiter },
              chunkSize
            );
            const [curr, ...rest] = split;
            if (curr) {
              txnType?.splice(txnType.length - 1, 1, curr);
            }
            txnType?.push(...rest);
          } else {
            txnType?.splice(txnType.length - 1, 1, (txn ?? "") + match[0]);
          }
        }
      }
    }
  }

  return splitTransactions;
};

export const extractDelimiters = (edi: string) => {
  const isaPos = edi.indexOf("ISA");
  if (isaPos < 0) {
    throw new Error("ISA header not found");
  }
  const elementDelimiter = edi[isaPos + 3];
  if (!elementDelimiter) {
    throw new ErrorWithContext(
      "Invalid EDI file ISA segment, element delimiter not found",
      {
        ISA: edi.slice(isaPos, isaPos + 108),
      }
    );
  }
  const gsPos = edi.indexOf(`GS${elementDelimiter}`);
  if (gsPos < 0 || isaPos > gsPos) {
    throw new Error("GS header not found");
  }
  const elemDelimPos = edi.lastIndexOf(elementDelimiter, gsPos);
  if (elemDelimPos < 0 || isaPos > elemDelimPos) {
    throw new Error("Element delimiter not found in ISA header");
  }
  let segmentDelimiter = edi[elemDelimPos + 2];
  if (segmentDelimiter === "\r") {
    segmentDelimiter += edi[elemDelimPos + 3];
  }

  if (!segmentDelimiter) {
    throw new ErrorWithContext(
      "Invalid EDI file ISA segment, segment delimiter not found",
      {
        ISA: edi.slice(isaPos, isaPos + 108),
      }
    );
  }
  return { elementDelimiter, segmentDelimiter };
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export const splitSingleTransaction = (
  edi: string,
  splitSegment: { start: string; end: string[] },
  delimiters: { segmentDelimiter: string; elementDelimiter: string },
  maxLoops = 1_000
): string[] => {
  const { elementDelimiter, segmentDelimiter } = delimiters;

  const segments = edi.split(segmentDelimiter);

  const allDocs: string[][] = [];
  const preambleSegments: string[] = [];
  let loopSegments: string[] = [];
  let loopCount = 0;
  const closingSegments: string[] = [];

  let stage: "before_loop" | "in_loop" | "after_loop" = "before_loop";

  for (const segment of segments) {
    const segmentId = segment.split(elementDelimiter)[0]!;

    if (stage === "before_loop" && segmentId !== splitSegment.start) {
      preambleSegments.push(segment);
    } else if (
      stage === "before_loop" ||
      (stage === "in_loop" && segmentId === splitSegment.start)
    ) {
      // start a new document, saving off previous doc
      if (stage === "in_loop" && loopCount >= maxLoops) {
        allDocs.push(loopSegments);
        loopSegments = [];
        loopCount = 0;
      }
      loopCount += 1;
      loopSegments.push(segment);
      stage = "in_loop";
    } else if (stage === "in_loop" && splitSegment.end.includes(segmentId)) {
      // past loop segment, starting closing segments
      allDocs.push(loopSegments);
      loopSegments = [];
      closingSegments.push(segment);
      stage = "after_loop";
    } else if (stage === "in_loop") {
      // more segments in loop
      loopSegments.push(segment);
    } else {
      // stage === "after_loop", add closing segments
      closingSegments.push(segment);
    }
  }

  // add preamble and closing segments to all items in allDocs
  const finishedDocs = allDocs.map(
    (doc) =>
      preambleSegments.join(segmentDelimiter) +
      segmentDelimiter +
      doc.join(segmentDelimiter) +
      segmentDelimiter +
      closingSegments.join(segmentDelimiter)
  );

  return finishedDocs;
};
