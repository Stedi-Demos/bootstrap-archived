import { format } from "date-fns";

import { translateJsonToEdi } from "../../../lib/translateV3.js";
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
  groupDeliveryResults
} from "../../../lib/deliveryManager.js";
import { loadPartnership } from "../../../lib/loadPartnership.js";
import { resolveGuide } from "../../../lib/resolveGuide.js";
import { lookupFunctionalIdentifierCode } from "../../../lib/lookupFunctionalIdentifierCode.ts.js";
import { loadPartnerProfile } from "../../../lib/loadPartnerProfile.js";
import {
  getTransactionSetConfigsForPartnership,
  groupTransactionSetConfigsByType,
  resolveTransactionSetConfig,
} from "../../../lib/transactionSetConfigs.js";
import { generateControlNumber } from "../../../lib/generateControlNumber.js";
import { invokeMapping } from "../../../lib/mappings.js";
import {
  OutboundEvent,
  OutboundEventSchema,
} from "../../../lib/types/OutboundEvent.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);
  console.log("starting", JSON.stringify({ input: event, executionId }));

  try {
    await recordNewExecution(executionId, event);
    const outboundEvent = OutboundEventSchema.parse(event);

    // load "my" Trading Partner profile
    const { sendingPartnerId } = outboundEvent.metadata;
    const senderProfile = await loadPartnerProfile(sendingPartnerId);

    // load the receiver's Trading Partner profile
    const { receivingPartnerId } = outboundEvent.metadata;
    const receiverProfile = await loadPartnerProfile(receivingPartnerId);

    // load the outbound x12 configuration for the sender
    const partnership = await loadPartnership(
      sendingPartnerId,
      receivingPartnerId
    );

    // get the transaction set from Guide JSON or event metadata
    const transactionSetType = determineTransactionSetType(outboundEvent);
    const release = determineRelease(outboundEvent);

    // get transaction set configs for partnership
    const transactionSetConfigs = getTransactionSetConfigsForPartnership({
      partnership,
      sendingPartnerId,
      receivingPartnerId,
    });

    const groupedTransactionSetConfigs = groupTransactionSetConfigsByType(transactionSetConfigs);

    // load the guide for the transaction set
    const guideSummary = await resolveGuide({
      guideIdsForPartnership: groupedTransactionSetConfigs.transactionSetConfigsWithGuideIds.map(
        (config) => config.guideId
      ),
      transactionSetType,
      release,
    });

    if (release && guideSummary.release !== release) {
      throw new Error(
        `No guide exists for the specified release: ${release}, found guide with release: ${guideSummary.release}`
      );
    }

    // find the transaction set config for partnership that includes guide
    const transactionSetConfig = resolveTransactionSetConfig(
      groupedTransactionSetConfigs.transactionSetConfigsWithGuideIds,
      guideSummary.guideId
    );

    // resolve the functional group for the transaction set
    const functionalIdentifierCode =
      lookupFunctionalIdentifierCode(transactionSetType);

    const documentDate = new Date();

    // Generate control number for sender/receiver pair
    const isaControlNumber = await generateControlNumber({
      segment: "ISA",
      usageIndicatorCode: transactionSetConfig.usageIndicatorCode,
      sendingPartnerId,
      receivingPartnerId,
    });
    const gsControlNumber = await generateControlNumber({
      segment: "GS",
      usageIndicatorCode: transactionSetConfig.usageIndicatorCode,
      sendingPartnerId,
      receivingPartnerId,
    });

    // Configure envelope data (interchange control header and functional group header) to combine with mapping result
    const envelope = {
      interchangeHeader: {
        senderQualifier: senderProfile.partnerInterchangeQualifier,
        senderId: senderProfile.partnerInterchangeId,
        receiverQualifier: receiverProfile.partnerInterchangeQualifier,
        receiverId: receiverProfile.partnerInterchangeId,
        date: format(documentDate, "yyyy-MM-dd"),
        time: format(documentDate, "HH:mm"),
        controlNumber: isaControlNumber,
        usageIndicatorCode: transactionSetConfig.usageIndicatorCode,
      },
      groupHeader: {
        functionalIdentifierCode,
        applicationSenderCode: senderProfile.partnerApplicationId,
        applicationReceiverCode: receiverProfile.partnerApplicationId,
        date: format(documentDate, "yyyy-MM-dd"),
        time: format(documentDate, "HH:mm:ss"),
        controlNumber: gsControlNumber,
      },
    };

    // TODO: add `inputMappingId` parameter for outbound workflow (https://github.com/Stedi-Demos/bootstrap/issues/36)
    //  and then refactor to use `deliverToDestinations` function
    const deliveryResults = await Promise.allSettled(
      transactionSetConfig.destinations.map(
        async ({ destination, mappingId }) => {
          const guideJson =
            mappingId !== undefined
              ? await invokeMapping(mappingId, outboundEvent.payload)
              : outboundEvent.payload;

          validateTransactionSetControlNumbers(guideJson);

          // Translate the Guide schema-based JSON to X12 EDI
          const translation = await translateJsonToEdi(
            guideJson,
            guideSummary.guideId,
            envelope
          );

          const destinationFilename = generateDestinationFilename(isaControlNumber, transactionSetType, "edi");
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
          deliveryResultsByStatus,
        ),
      );
    }

    await markExecutionAsSuccessful(executionId);

    return {
      statusCode: 200,
      deliveryResults: deliveryResultsByStatus.fulfilled.map((r) => r.value),
    };
  } catch (e) {
    const errorWithContext = ErrorWithContext.fromUnknown(e);
    return failedExecution(executionId, errorWithContext);
  }
};

const determineTransactionSetType = (event: OutboundEvent): string => {
  return (
    event.metadata.transactionSet ??
    extractTransactionSetTypeFromGuideJson(event.payload)
  );
};

const determineRelease = (event: OutboundEvent): string | undefined => event.metadata.release;

const normalizeGuideJson = (guideJson: any): any[] => {
  // guide JSON can either be a single transaction set object: { heading, detail, summary },
  // or an array of transaction set objects: [{ heading, detail, summary}]
  return Array.isArray(guideJson) ? guideJson : [guideJson];
};

const extractTransactionSetTypeFromGuideJson = (guideJson: any): string => {
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
      const message =
        `invalid control number for transaction set: [expected: ${expectedControlNumber}, found: ${controlNumberValue}]`;
      console.log(message);
      throw new Error(message);
    }

    expectedControlNumber++;
  });
};
