import { format } from "date-fns";
import { translateJsonToEdi } from "../../../lib/translateEDI.js";
import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import {
  processSingleDelivery,
  ProcessSingleDeliveryInput,
  generateDestinationFilename,
  groupDeliveryResults,
} from "../../../lib/deliveryManager.js";
import { lookupFunctionalIdentifierCode } from "../../../lib/lookupFunctionalIdentifierCode.ts.js";
import { generateControlNumber } from "../../../lib/generateControlNumber.js";
import { invokeMapping } from "../../../lib/mappings.js";
import {
  OutboundEvent,
  OutboundEventSchema,
} from "../../../lib/types/OutboundEvent.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { loadPartnershipById } from "../../../lib/loadPartnershipById.js";
import { loadTransactionSetDestinations } from "../../../lib/loadTransactionSetDestinations.js";

export const handler = async (
  event: OutboundEvent
): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);

  try {
    await recordNewExecution(executionId, event);
    const outboundEvent = OutboundEventSchema.parse(event);

    // load the outbound x12 configuration for the sender
    const partnership = await loadPartnershipById({
      partnershipId: event.metadata.partnershipId,
    });

    // get the transaction set from Guide JSON or event metadata
    const transactionSetIdentifier =
      determineTransactionSetIdentifier(outboundEvent);

    const transactionSetConfig = partnership.outboundTransactions?.find(
      (txn) => txn.transactionSetIdentifier === transactionSetIdentifier
    );

    if (transactionSetConfig === undefined)
      throw new Error(
        `Transaction set not found in partnership configuration for '${transactionSetIdentifier}'`
      );

    const transactionSetDestinations = await loadTransactionSetDestinations(
      transactionSetConfig.transactionId!
    );

    // resolve the functional group for the transaction set
    const functionalIdentifierCode = lookupFunctionalIdentifierCode(
      transactionSetIdentifier
    );

    const documentDate = new Date();

    // Generate control number for sender/receiver pair
    const isaControlNumber = await generateControlNumber({
      segment: "ISA",
      usageIndicatorCode: event.metadata.usageIndicatorCode,
      sendingPartnerId: partnership.localProfileId!,
      receivingPartnerId: partnership.partnerProfileId!,
    });

    const gsControlNumber = await generateControlNumber({
      segment: "GS",
      usageIndicatorCode: event.metadata.usageIndicatorCode,
      sendingPartnerId: partnership.localProfileId!,
      receivingPartnerId: partnership.partnerProfileId!,
    });

    // Configure envelope data (interchange control header and functional group header) to combine with mapping result
    const envelope = {
      interchangeHeader: {
        senderQualifier: partnership.localProfile!.interchangeQualifier,
        senderId: partnership.localProfile!.interchangeId,
        receiverQualifier: partnership.partnerProfile!.interchangeQualifier,
        receiverId: partnership.partnerProfile?.interchangeId,
        date: format(documentDate, "yyyy-MM-dd"),
        time: format(documentDate, "HH:mm"),
        controlNumber: isaControlNumber,
        usageIndicatorCode: event.metadata.usageIndicatorCode,
      },
      groupHeader: {
        functionalIdentifierCode,
        applicationSenderCode: partnership.localProfile!.interchangeQualifier,
        applicationReceiverCode:
          partnership.partnerProfile!.interchangeQualifier,
        date: format(documentDate, "yyyy-MM-dd"),
        time: format(documentDate, "HH:mm:ss"),
        controlNumber: gsControlNumber,
      },
    };

    // TODO: add `inputMappingId` parameter for outbound workflow (https://github.com/Stedi-Demos/bootstrap/issues/36)
    //  and then refactor to use `deliverToDestinations` function
    const deliveryResults = await Promise.allSettled(
      transactionSetDestinations.destinations.map(
        async ({ destination, mappingId }) => {
          const guideJson =
            mappingId !== undefined
              ? await invokeMapping(mappingId, outboundEvent.payload)
              : outboundEvent.payload;

          validateTransactionSetControlNumbers(guideJson);

          // Translate the Guide schema-based JSON to X12 EDI
          const translation = await translateJsonToEdi(
            guideJson,
            transactionSetConfig.guideId,
            envelope
          );

          const destinationFilename = generateDestinationFilename(
            isaControlNumber,
            transactionSetIdentifier,
            "edi"
          );
          const deliverToDestinationInput: ProcessSingleDeliveryInput = {
            destination,
            payload: translation,
            destinationFilename,
          };
          return await processSingleDelivery(deliverToDestinationInput);
        }
      )
    );

    const deliveryResultsByStatus = groupDeliveryResults(deliveryResults);
    const rejectedCount = deliveryResultsByStatus.rejected.length;
    if (rejectedCount > 0) {
      return failedExecution(
        executionId,
        new ErrorWithContext(
          `some deliveries were not successful: ${rejectedCount} failed, ${deliveryResultsByStatus.fulfilled.length} succeeded`,
          deliveryResultsByStatus
        )
      );
    }

    await markExecutionAsSuccessful(executionId);

    return {
      statusCode: 200,
      deliveryResults: deliveryResultsByStatus.fulfilled.map((r) => r.value),
    };
  } catch (e) {
    console.error(e);
    const errorWithContext = ErrorWithContext.fromUnknown(e);
    return failedExecution(executionId, errorWithContext);
  }
};

const determineTransactionSetIdentifier = (event: OutboundEvent): string => {
  return (
    event.metadata.transactionSet ??
    extractTransactionSetIdentifierFromGuideJson(event.payload)
  );
};

const normalizeGuideJson = (guideJson: any): any[] => {
  // guide JSON can either be a single transaction set object: { heading, detail, summary },
  // or an array of transaction set objects: [{ heading, detail, summary}]
  return Array.isArray(guideJson) ? guideJson : [guideJson];
};

const extractTransactionSetIdentifierFromGuideJson = (
  guideJson: any
): string => {
  const normalizedGuideJson = normalizeGuideJson(guideJson);

  // ensure that there is exactly 1 transaction set type in the input
  const uniqueTransactionSets = normalizedGuideJson.reduce(
    (transactionSetIds: Set<string>, t) => {
      const currentId =
        t.heading?.transaction_set_header_ST
          ?.transaction_set_identifier_code_01;
      if (currentId !== undefined) {
        transactionSetIds.add(currentId as string);
      }

      return transactionSetIds;
    },
    new Set<string>()
  );

  if (uniqueTransactionSets.size !== 1) {
    throw new Error("unable to determine transaction set type from input");
  }

  return uniqueTransactionSets.values().next().value;
};

const validateTransactionSetControlNumbers = (guideJson: any) => {
  const normalizedGuideJson = normalizeGuideJson(guideJson);

  let expectedControlNumber = 1;
  normalizedGuideJson.forEach((t) => {
    // handle both string and numeric values
    const controlNumberValue = Number(
      t.heading?.transaction_set_header_ST?.transaction_set_control_number_02
    );
    if (controlNumberValue !== expectedControlNumber) {
      const message = `invalid control number for transaction set: [expected: ${expectedControlNumber}, found: ${controlNumberValue}]`;
      console.log(message);
      throw new Error(message);
    }

    expectedControlNumber++;
  });
};
