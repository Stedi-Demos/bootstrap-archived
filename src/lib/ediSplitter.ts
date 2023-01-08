export type EdiDocumentMetadata = {
  release: string;
  code: string;
  senderId: string;
  receiverId: string;
};

export type EdiDocument = {
  metadata: EdiDocumentMetadata;
  edi: string;
};

type ISA = {
  senderId: string;
  receiverId: string;
  contents: string;
};

type FunctionalGroup = {
  release: string;
  code?: string;
  contents: string[];
};

// split input into multiple EDI documents, along with metadata:
// [
//   {
//     metadata: {
//       release: "5010",
//       code: "855",
//       senderId: "AMERCHANT",
//       receiverId: "ANOTHERMERCH",
//     },
//     edi: ${ediDocument},
//   },
// ]
//
// - input EDI documents may only contain one functional group within an interchange
// - input EDI documents may only contain multiple transaction sets within a functional group if they are the same type
export const splitEdi = (ediDocument: string): EdiDocument[] => {
  const { segmentDelimiter, elementDelimiter } = extractDelimiters(ediDocument);

  // If segmentDelimiter is not a newline, remove trailing newlines
  if (!segmentDelimiter.match(/(\r?\n|\r)$/g)) {
    ediDocument = ediDocument.replace(/\r?\n|\r/g, "");
  }

  // split input on segment delimiter (and filter out any empty segments, such as after the final segment terminator)
  const segments = ediDocument
    .split(segmentDelimiter)
    .filter((segment) => segment);

  let isa: ISA | undefined;
  let functionalGroup: FunctionalGroup | undefined;

  return segments.reduce((splitEdis: EdiDocument[], currentSegment) => {
    const elements = currentSegment.trim().split(elementDelimiter);
    switch (elements[0]) {
      case "ISA":
        // this use case could be accommodated in the future by auto-generating an IEA
        if (functionalGroup) {
          throw new Error(
            "interchange start encountered without previous interchange termination"
          );
        }

        isa = { ...extractIsaIds(elements), contents: currentSegment };
        break;
      case "GS":
        if (functionalGroup) {
          throw new Error(
            "only one functional group is allowed per interchange"
          );
        }

        const release = extractRelease(elements);
        functionalGroup = { release, contents: [currentSegment] };
        break;
      case "ST":
        if (!functionalGroup) {
          throw new Error(
            "transaction set encountered outside the scope of a functional group"
          );
        }

        const code = extractTransactionSetCode(elements);
        ensureFunctionalGroupCodeIsPopulated(functionalGroup, code);
        functionalGroup.contents.push(currentSegment);
        break;
      case "GE":
        finalizeFunctionalGroup(currentSegment, functionalGroup);
        break;
      case "IEA":
        splitEdis.push(
          finalizeEdiDocument(
            currentSegment,
            segmentDelimiter,
            functionalGroup,
            isa
          )
        );
        functionalGroup = undefined;
        isa = undefined;
        break;
      default:
        if (!functionalGroup) {
          throw new Error(
            "segment encountered outside the scope of a functional group"
          );
        }
        functionalGroup.contents.push(currentSegment);
    }

    return splitEdis;
  }, []);
};

const extractDelimiters = (
  ediDocument: string
): { segmentDelimiter: string; elementDelimiter: string } => {
  // The ISA segment should be 106 characters, so the entire document should be bigger than that
  if (ediDocument.length < 106 || !ediDocument.trimStart().startsWith("ISA")) {
    throw new Error("invalid ISA segment");
  }

  const elementDelimiter = ediDocument.charAt(3);

  // The ISA itself should have at 17 elements
  const ediElements = ediDocument.split(elementDelimiter);
  if (ediElements.length < 18) {
    throw new Error("too few elements detected in document");
  }

  const delimitersElement = ediElements[16];
  // In practice, this should check should never fail -- if the delimiters element is too
  // short, the following segment identifier gets pulled into the delimiters element
  if (delimitersElement.length < 2) {
    throw new Error("invalid ISA segment: unable to extract delimiters");
  }

  const segmentDelimiter = delimitersElement[1];
  return { segmentDelimiter, elementDelimiter };
};

const extractIsaIds = (
  elements: string[]
): { senderId: string; receiverId: string } => {
  if (elements.length !== 17) {
    throw new Error("invalid ISA segment: not enough elements detected");
  }

  return {
    senderId: `${elements[5].trim()}/${elements[6].trim()}`,
    receiverId: `${elements[7].trim()}/${elements[8].trim()}`,
  };
};

const extractRelease = (elements: string[]): string => {
  if (elements.length < 9) {
    throw new Error("invalid GS segment: not enough elements detected");
  }

  return elements[8];
};

const extractTransactionSetCode = (elements: string[]): string => {
  if (elements.length < 3) {
    throw new Error("invalid ST segment: not enough elements detected");
  }

  return elements[1];
};

const ensureFunctionalGroupCodeIsPopulated = (
  functionalGroup: FunctionalGroup,
  code: string
): void => {
  if (functionalGroup.code && functionalGroup.code !== code) {
    throw new Error(
      "all transaction sets within a functional group must be the same type"
    );
  }

  if (!functionalGroup.code) {
    functionalGroup.code = code;
  }
};

const finalizeFunctionalGroup = (
  segment: string,
  functionalGroup?: FunctionalGroup
): Required<FunctionalGroup> => {
  if (!functionalGroup) {
    throw new Error(
      "functional group terminator encountered outside the scope of a functional group"
    );
  }
  if (!functionalGroup?.code) {
    throw new Error("functional group transaction set code was not found");
  }

  functionalGroup.contents.push(segment);

  return {
    release: functionalGroup.release,
    code: functionalGroup.code,
    contents: functionalGroup.contents,
  };
};

const finalizeEdiDocument = (
  segment: string,
  segmentDelimiter: string,
  functionalGroup?: FunctionalGroup,
  isa?: ISA
): EdiDocument => {
  if (!isa) {
    throw new Error(
      "interchange terminator encountered outside the scope of an interchange"
    );
  }

  const isaSegment = isa.contents.concat(segmentDelimiter);
  const ieaSegment = segment.concat(segmentDelimiter);

  if (!functionalGroup) {
    throw new Error("no functional group found in interchange");
  }

  if (!functionalGroup.code) {
    throw new Error("functional group transaction set code was not found");
  }

  const interchangeContents = functionalGroup.contents
    .join(segmentDelimiter)
    .concat(segmentDelimiter);

  return {
    metadata: {
      senderId: isa.senderId,
      receiverId: isa.receiverId,
      code: functionalGroup.code,
      release: functionalGroup.release,
    },
    edi: [isaSegment, interchangeContents, ieaSegment].join(""),
  };
};
