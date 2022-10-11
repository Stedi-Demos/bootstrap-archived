export interface SplitEdi {
  code: string;
  edi: string;
}

// split edi file by transaction set codes preserving ISA and GS headers
// ISA -- GS -- ST850 -- SE -- ST977 -- SE -- GE -- IEA split into array
// { "850", ISA -- GS -- ST850 -- GE -- IEA },
// { "977", ISA -- GS -- ST977 -- GE -- IEA }

export const ediSplitter = (edi: string) => {
  // validate edi
  if (!isValidEDi(edi)) {
    throw new Error("Invalid edi file: missing or incorrect length isa header");
  }

  // extract ISA
  const firstIsaSegment = extractIsaSegment(edi);

  // extract delimiters
  const { elementDelimiter, segmentDelimiter } =
    extractDelimiters(firstIsaSegment);

  let isa: string;
  let gs: string;
  let code: string;
  const split = new Map<string, string>();
  const splitEdis: SplitEdi[] = [];
  const re = new RegExp(
    `(?:(\\w+)${escapeRegExp(elementDelimiter)}(?:.*?)${escapeRegExp(
      segmentDelimiter
    )})+?`,
    "gm"
  );

  for (const match of edi.matchAll(re)) {
    switch (match[1]) {
      case "ISA":
        isa = match[0];
        break;
      case "GS":
        gs = match[0];
        break;
      case "ST":
        code = match[0].split(elementDelimiter)[1];
        // @ts-ignore gs should be set during a preceding iteration of the loop
        if (!gs) {
          throw new Error("invalid EDI file: functional group not extracted before transaction set");
        }
        split.set(code, (split.get(code) ?? "") + gs + match[0]);
        break;
      case "GE":
        split.forEach((seg, code) => {
          split.set(code, seg + match[0]);
        });
        break;
      case "IEA":
        split.forEach((seg, code) => {
          splitEdis.push({ code, edi: isa + seg + match[0] });
        });
        split.clear();
        break;
      default:
        // @ts-ignore code should be set during a preceding iteration of the loop
        if (!code) {
          throw new Error("invalid EDI file: transaction set has not been identified");
        }
        split.set(code, split.get(code) + match[0]);
    }
  }

  return splitEdis;
};

const isValidEDi = (edi: string) => {
  return edi.startsWith("ISA") && edi.length >= 106;
};

const extractIsaSegment = (edi: string) => {
  const isaSegment = edi.trimStart().slice(0, 106);
  return isaSegment;
};

const extractDelimiters = (isaSegment: string) => {
  const elementDelimiter = isaSegment.at(-3);
  const subelementDelimiter = isaSegment.at(-2);
  const segmentDelimiter = isaSegment.at(-1);
  if(!elementDelimiter || !subelementDelimiter || !segmentDelimiter) {
    throw new Error("invalid EDI file: unable to extract delimiters");
  }

  return { elementDelimiter, subelementDelimiter, segmentDelimiter };
};

function escapeRegExp(regExpString: string) {
  return regExpString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}