import { formatInTimeZone } from "date-fns-tz";
import { translateJsonToEdi } from "../../../lib/translateEDI.js";
import {
  failedExecution,
  FailureResponse,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import {
  processSingleDelivery,
  ProcessSingleDeliveryInput,
  groupDeliveryResults,
} from "../../../lib/deliveryManager.js";
import { lookupFunctionalIdentifierCode } from "../../../lib/lookupFunctionalIdentifierCode.js";
import { invokeMapping } from "../../../lib/mappings.js";
import {
  OutboundEvent,
  OutboundEventSchema,
} from "../../../lib/types/OutboundEvent.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { loadPartnershipById } from "../../../lib/loadPartnershipById.js";
import { EdiTranslateWriteEnvelope } from "../../../lib/types/EdiTranslateWriteEnvelope.js";
import { partnersClient } from "../../../lib/clients/partners.js";
import { IncrementX12ControlNumberCommand } from "@stedi/sdk-client-partners";
import { loadTransactionDestinations } from "../../../lib/loadTransactionDestinations.js";
import { ErrorFromFunctionEvent } from "../../../lib/errorFromFunctionEvent.js";

const partners = partnersClient();

export const handler = async (
  event: OutboundEvent
): Promise<Record<string, unknown> | FailureResponse> => {
  const executionId = generateExecutionId(event);

  try {
    await recordNewExecution(executionId, event);

    const outboundEventParseResult = OutboundEventSchema.safeParse(event);

    if (!outboundEventParseResult.success) {
      throw new ErrorFromFunctionEvent(
        `edi-outbound`,
        outboundEventParseResult
      );
    }

    const outboundEvent = outboundEventParseResult.data;

    // load the outbound x12 configuration for the sender
    const partnership = await loadPartnershipById({
      partnershipId: event.metadata.partnershipId,
    });

    // get the transaction set from Guide JSON or event metadata
    const transactionSetIdentifier =
      determineTransactionSetIdentifier(outboundEvent);

    // select the transaction set configuration that matches the release in the metadata,
    // allows for multiple transaction set configurations for a transaction, if they have different releases
    const transactionSetConfig = partnership.outboundTransactions?.find(
      (txn) =>
        txn.transactionSetIdentifier === transactionSetIdentifier &&
        (!event.metadata.release || txn.release === event.metadata.release)
    );

    if (transactionSetConfig === undefined)
      throw new Error(
        `Transaction set not found in partnership configuration for '${transactionSetIdentifier}'`
      );

    const transactionSetDestinations = await loadTransactionDestinations({
      partnershipId: event.metadata.partnershipId,
      transactionSetIdentifier,
    });

    // resolve the functional group for the transaction set
    const functionalIdentifierCode = lookupFunctionalIdentifierCode(
      transactionSetIdentifier
    );

    const documentDate = new Date();

    // Generate control number for sender/receiver pair
    const { x12ControlNumber: isaControlNumber } = (await partners.send(
      new IncrementX12ControlNumberCommand({
        partnershipId: partnership.partnershipId,
        controlNumberType: "interchange",
      })
    )) as { x12ControlNumber: number };

    const { x12ControlNumber: gsControlNumber } = (await partners.send(
      new IncrementX12ControlNumberCommand({
        partnershipId: partnership.partnershipId,
        controlNumberType: "group",
      })
    )) as { x12ControlNumber: number };

    // Configure envelope data (interchange control header and functional group header) to combine with mapping result
    const envelope: EdiTranslateWriteEnvelope = {
      interchangeHeader: {
        senderQualifier: partnership.localProfile
          .interchangeQualifier as EdiTranslateWriteEnvelope["interchangeHeader"]["senderQualifier"],
        senderId: partnership.localProfile.interchangeId,
        receiverQualifier: partnership.partnerProfile
          .interchangeQualifier as EdiTranslateWriteEnvelope["interchangeHeader"]["receiverQualifier"],
        receiverId: partnership.partnerProfile.interchangeId,
        date: formatInTimeZone(
          documentDate,
          partnership.timezone,
          "yyyy-MM-dd"
        ),
        time: formatInTimeZone(documentDate, partnership.timezone, "HH:mm"),
        controlNumber: isaControlNumber.toString(),
        usageIndicatorCode: event.metadata.usageIndicatorCode,
        controlVersionNumber: transactionSetConfig.release.slice(
          0,
          5
        ) as EdiTranslateWriteEnvelope["interchangeHeader"]["controlVersionNumber"],
      },
      groupHeader: {
        functionalIdentifierCode: functionalIdentifierCode,
        applicationSenderCode:
          partnership.localProfile.defaultApplicationId ??
          partnership.localProfile.interchangeId,
        applicationReceiverCode:
          partnership.partnerProfile.defaultApplicationId ??
          partnership.partnerProfile.interchangeId,
        date: formatInTimeZone(
          documentDate,
          partnership.timezone,
          "yyyy-MM-dd"
        ),
        time: formatInTimeZone(documentDate, partnership.timezone, "HH:mm:ss"),
        controlNumber: gsControlNumber.toString(),
        release: transactionSetConfig.release,
      },
    };

    // TODO: add `inputMappingId` parameter for outbound workflow (https://github.com/Stedi-Demos/bootstrap/issues/36)
    //  and then refactor to use `deliverToDestinations` function
    const deliveryResults = await Promise.allSettled(
      transactionSetDestinations.destinations
        .filter((d) =>
          filterDestination(d, outboundEvent, transactionSetConfig)
        )
        .map(async ({ destination, mappingId }) => {
          const guideJson =
            mappingId !== undefined
              ? await invokeMapping(mappingId, outboundEvent.payload)
              : outboundEvent.payload;

          validateTransactionSetControlNumbers(guideJson);

          // Translate the Guide schema-based JSON to X12 EDI
          const translation = await translateJsonToEdi(
            guideJson,
            transactionSetConfig.guideId,
            envelope,
            event.metadata.useBuiltInGuide
          );

          const payloadId = `${isaControlNumber}-${gsControlNumber}-${transactionSetIdentifier}`;

          const deliverToDestinationInput: ProcessSingleDeliveryInput = {
            destination,
            payload: translation,
            payloadMetadata: {
              payloadId,
              format: "edi",
            },
          };
          return await processSingleDelivery(deliverToDestinationInput);
        })
    );

    const deliveryResultsByStatus = groupDeliveryResults(deliveryResults, {
      payload: outboundEvent,
      destinations: transactionSetDestinations.destinations,
    });
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
      deliveryResults: deliveryResultsByStatus.fulfilled,
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

const normalizeGuideJson = (guideJson: unknown): unknown[] => {
  // guide JSON can either be a single transaction set object: { heading, detail, summary },
  // or an array of transaction set objects: [{ heading, detail, summary}]
  return Array.isArray(guideJson) ? guideJson : [guideJson];
};

const extractTransactionSetIdentifierFromGuideJson = (
  guideJson: unknown
): string => {
  const normalizedGuideJson = normalizeGuideJson(guideJson);

  // ensure that there is exactly 1 transaction set type in the input
  const uniqueTransactionSets = normalizedGuideJson.reduce(
    (transactionSetIds: Set<string>, t) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const currentId =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        (t as any).heading?.transaction_set_header_ST
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

  const result = uniqueTransactionSets.values().next().value as string;

  return result;
};

const validateTransactionSetControlNumbers = (guideJson: unknown) => {
  const normalizedGuideJson = normalizeGuideJson(guideJson);

  let expectedControlNumber = 1;
  normalizedGuideJson.forEach((t) => {
    // handle both string and numeric values
    const controlNumberValue = Number(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      (t as any).heading?.transaction_set_header_ST
        ?.transaction_set_control_number_02
    );
    if (controlNumberValue !== expectedControlNumber) {
      const message = `invalid control number for transaction set: [expected: ${expectedControlNumber}, found: ${controlNumberValue}]`;
      console.log(message);
      throw new Error(message);
    }

    expectedControlNumber++;
  });
};

const filterDestination = (
  destination: { usageIndicatorCode?: string; release?: string },
  event: { metadata: { usageIndicatorCode: string } },
  transactionSetConfig: { release: string }
) => {
  if (
    destination.usageIndicatorCode &&
    destination.usageIndicatorCode !== event.metadata.usageIndicatorCode
  ) {
    return false;
  }

  if (
    destination.release &&
    transactionSetConfig.release !== destination.release
  ) {
    return false;
  }

  return true;
};
