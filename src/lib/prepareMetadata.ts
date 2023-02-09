import { UsageIndicatorCode, UsageIndicatorCodeSchema } from "./types/PartnerRouting.js";

export type EDIMetadata = {
  interchange: Interchange;
  edi: string;
};

type Interchange = {
  senderId: string;
  receiverId: string;
  controlNumber: number;
  functionalGroups: FunctionalGroup[];
  delimiters: {
    element: string;
    segment: string;
  };
  usageIndicatorCode: UsageIndicatorCode;
  segments: {
    ISA: string;
    IEA?: string;
  };
};

type FunctionalGroup = {
  release: string;
  controlNumber: number;
  applicationSenderCode: string;
  applicationReceiverCode: string;
  transactionSets: TransactionSet[];
  segments: {
    GS: string;
    GE?: string;
  };
};

type TransactionSet = {
  controlNumber: number;
  transactionSetType: string;
  segments: string[];
};

// split input into multiple EDI documents, along with metadata:
//
export const prepareMetadata = (ediDocument: string): EDIMetadata[] => {
  const { segmentDelimiter, elementDelimiter } = extractDelimiters(ediDocument);

  // If segmentDelimiter is not a newline, remove trailing newlines
  if (!segmentDelimiter.match(/(\r?\n|\r)$/g)) {
    ediDocument = ediDocument.replace(/\r?\n|\r/g, "");
  }

  // split input on segment delimiter (and filter out any empty segments, such as after the final segment terminator)
  const segments = ediDocument
    .split(segmentDelimiter)
    .filter((segment) => segment);

  let currentInterchange: Interchange | undefined;
  let currentFunctionalGroup: FunctionalGroup | undefined;
  let currentTransactionSet: TransactionSet | undefined;

  return segments.reduce((results: EDIMetadata[], currentSegment) => {
    const elements = currentSegment.trim().split(elementDelimiter);
    switch (elements[0]) {
      case "ISA":
        // this use case could be accommodated in the future by auto-generating an IEA
        if (currentFunctionalGroup)
          throw new Error(
            "interchange start encountered without previous interchange termination"
          );

        currentInterchange = {
          ...extractIsaMetadata(elements),
          functionalGroups: [],
          delimiters: {
            element: elementDelimiter,
            segment: segmentDelimiter,
          },
          segments: { ISA: currentSegment },
        };
        break;
      case "GS":
        if (currentFunctionalGroup) {
          throw new Error(
            "new functional group encountered without previous functional group termination"
          );
        }

        currentFunctionalGroup = {
          ...extractFunctionalGroupMetadata(elements),

          transactionSets: [],
          segments: { GS: currentSegment },
        };
        break;
      case "ST":
        if (!currentFunctionalGroup) {
          throw new Error(
            "transaction set encountered outside the scope of a functional group"
          );
        }

        if (currentTransactionSet !== undefined)
          throw new Error("incomplete transaction set found");

        const transactionSetType = extractTransactionSetType(elements);

        currentTransactionSet = {
          transactionSetType,
          controlNumber: parseInt(elements[2]),
          segments: [currentSegment],
        };

        break;
      case "SE":
        if (!currentFunctionalGroup)
          throw new Error(
            "transaction set encountered outside the scope of a functional group"
          );
        currentTransactionSet = finalizeTransactionSet(
          currentSegment,
          currentTransactionSet
        );
        currentFunctionalGroup.transactionSets.push(currentTransactionSet);
        currentTransactionSet = undefined;

        break;
      case "GE":
        currentFunctionalGroup = finalizeFunctionalGroup(
          currentSegment,
          currentFunctionalGroup
        );

        if (currentFunctionalGroup.transactionSets.length === 0)
          throw new Error("functional group contains no transaction sets");

        currentInterchange?.functionalGroups.push(currentFunctionalGroup);

        currentFunctionalGroup = undefined;
        break;
      case "IEA":
        results.push(
          finalizeEdiDocument(
            currentSegment,
            segmentDelimiter,
            currentInterchange
          )
        );
        currentFunctionalGroup = undefined;
        currentInterchange = undefined;
        break;
      default:
        if (!currentTransactionSet) {
          throw new Error(
            "segment encountered outside the scope of a transaction"
          );
        }
        currentTransactionSet.segments.push(currentSegment);
    }

    return results;
  }, []);
};

export const extractDelimiters = (
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

const extractIsaMetadata = (
  elements: string[]
): {
  senderId: string;
  receiverId: string,
  controlNumber: number,
  usageIndicatorCode: UsageIndicatorCode
} => {
  if (elements.length !== 17) {
    throw new Error("invalid ISA segment: not enough elements detected");
  }

  return {
    senderId: `${elements[5].trim()}/${elements[6].trim()}`,
    receiverId: `${elements[7].trim()}/${elements[8].trim()}`,
    controlNumber: parseInt(elements[12]),
    usageIndicatorCode: UsageIndicatorCodeSchema.parse(elements[15]),
  };
};

const extractFunctionalGroupMetadata = (elements: string[]) => {
  if (elements.length < 9) {
    throw new Error("invalid GS segment: not enough elements detected");
  }

  return {
    release: elements[8],
    controlNumber: parseInt(elements[5]),
    applicationSenderCode: elements[2],
    applicationReceiverCode: elements[3],
  };
};

const extractTransactionSetType = (elements: string[]): string => {
  if (elements.length < 3) {
    throw new Error("invalid ST segment: not enough elements detected");
  }

  const transactionSetType = elements[1];

  if (transactionSetType.length == 0)
    throw new Error("invalid ST segment: transaction set type not found");

  if (transactionSetType.length < 3)
    throw new Error("invalid ST segment: transaction set type is too short");

  return transactionSetType;
};

const finalizeFunctionalGroup = (
  segment: string,
  functionalGroup?: FunctionalGroup
): FunctionalGroup => {
  if (!functionalGroup)
    throw new Error(
      "functional group terminator encountered outside the scope of a functional group"
    );

  if (functionalGroup.transactionSets.length === 0)
    throw new Error("functional group transaction set type was not found");

  functionalGroup.segments.GE = segment;

  return functionalGroup;
};

const finalizeTransactionSet = (
  segment: string,
  transactionSet?: TransactionSet
): Required<TransactionSet> => {
  if (!transactionSet)
    throw new Error(
      "transaction set terminator encountered outside the scope of a transaction set"
    );

  transactionSet.segments.push(segment);

  return transactionSet;
};

const finalizeEdiDocument = (
  segment: string,
  segmentDelimiter: string,
  interchange?: Interchange
): EDIMetadata => {
  if (!interchange) {
    throw new Error(
      "interchange terminator encountered outside the scope of an interchange"
    );
  }

  interchange.segments.IEA = segment;

  if (interchange.functionalGroups.length === 0)
    throw new Error("no functional group found in interchange");

  const interchangeContents = interchange.functionalGroups
    .flatMap(({ transactionSets, segments: { GE, GS } }) =>
      [
        GS,
        transactionSets
          .map((ts) => ts.segments.join(segmentDelimiter))
          .join(segmentDelimiter),
        GE,
      ].join(segmentDelimiter)
    )
    .join(segmentDelimiter);

  return {
    interchange,
    edi: [
      interchange.segments.ISA,
      interchangeContents,
      interchange.segments.IEA,
    ]
      .join(segmentDelimiter)
      .concat(segmentDelimiter),
  };
};
