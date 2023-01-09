import { format } from "date-fns";
import { serializeError } from "serialize-error";
import { IncrementValueCommand, StashClient } from "@stedi/sdk-client-stash";
import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";
import { translateJsonToEdi } from "../../../lib/translateV3.js";
import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { DEFAULT_SDK_CLIENT_PROPS } from "../../../lib/constants.js";
import { deliverToDestination } from "../../../lib/deliverToDestination.js";
import { loadPartnership } from "../../../lib/loadPartnership.js";
import { resolveGuide } from "../../../lib/resolveGuide.js";
import { lookupFunctionalIdentifierCode } from "../../../lib/lookupFunctionalIdentifierCode.ts.js";
import { loadX12PartnerProfile } from "../../../lib/loadX12PartnerProfile.js";
import { resolveSenderCode } from "../../../lib/resolveSenderCode.js";
import { resolveTransactionSetConfig } from "../../../lib/resolveTransactionSetConfig.js";
import { generateControlNumber } from "../../../lib/generateControlNumber.js";

const mappingsClient = new MappingsClient(DEFAULT_SDK_CLIENT_PROPS);

type OutboudEvent = {
  metadata: {
    sendingPartnerId: string;
    receivingPartnerId: string;
    transactionSet?: string;
  };
  payload: any;
};

export const handler = async (
  event: OutboudEvent
): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);
  console.log("starting", JSON.stringify({ input: event, executionId }));

  try {
    await recordNewExecution(executionId, event);

    // load "my" Trading Partner profile
    const { sendingPartnerId } = event.metadata;
    const senderX12Profile = await loadX12PartnerProfile(sendingPartnerId);

    // load the receiver's Trading Partner profile
    const { receivingPartnerId } = event.metadata;
    const receiverX12Profile = await loadX12PartnerProfile(receivingPartnerId);

    // load the outbound x12 configuration for the sender
    const partnership = await loadPartnership(
      sendingPartnerId,
      receivingPartnerId
    );

    // get the transaction set from Guide JSON or event metadata
    const transactionSet = determineTransactionSet(event);

    // get the config for the transaction set
    const transactionSetConfig = resolveTransactionSetConfig({
      partnership,
      sendingPartnerId,
      receivingPartnerId,
    });

    // load the guide for the transaction set
    const guideSummary = await resolveGuide({
      guideIds: transactionSetConfig.guideIds || [],
      transactionSet,
    });
    if (guideSummary === undefined)
      throw new Error(`No guide found for transaction set '${transactionSet}'`);

    // resolve the functional group for the transaction set
    const functionalIdentifierCode =
      lookupFunctionalIdentifierCode(transactionSet);

    // resolve senders applicaitonId / senderCode
    const applicationSenderCode = resolveSenderCode(
      partnership,
      sendingPartnerId
    );
    const applicationReceiverCode = resolveSenderCode(
      partnership,
      receivingPartnerId
    );

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
    const stControlNumber = "0001"; //TODO: this should be based on the number of ST segments in the document

    // Configure envelope data (interchange control header and functional group header) to combine with mapping result
    const envelope = {
      interchangeHeader: {
        senderQualifier: senderX12Profile.partnerInterchangeQualifier,
        senderId: senderX12Profile.partnerInterchangeId,
        receiverQualifier: receiverX12Profile.partnerInterchangeQualifier,
        receiverId: receiverX12Profile.partnerInterchangeId,
        date: format(documentDate, "yyyy-MM-dd"),
        time: format(documentDate, "HH:mm"),
        controlNumber: isaControlNumber,
        usageIndicatorCode: transactionSetConfig.usageIndicatorCode,
      },
      groupHeader: {
        functionalIdentifierCode,
        applicationSenderCode,
        applicationReceiverCode,
        date: format(documentDate, "yyyy-MM-dd"),
        time: format(documentDate, "HH:mm:ss"),
        controlNumber: gsControlNumber,
      },
    };

    const deliveryResults = [];

    for (const {
      destination,
      mappingId,
    } of transactionSetConfig.destinations) {
      console.log(destination);

      let guideGuideJson: any;

      if (mappingId !== undefined) {
        // Execute mapping to transform API JSON input to Guide schema-based JSON
        const mapResult = await mappingsClient.send(
          new MapDocumentCommand({
            id: mappingId,
            content: { controlNumber: stControlNumber, ...event.payload },
          })
        );
        console.log(`mapping result: ${JSON.stringify(mapResult)}`);
        guideGuideJson = mapResult.content;
      } else {
        guideGuideJson = event.payload;
        guideGuideJson.heading.transaction_set_header_ST.transaction_set_control_number_02 =
          stControlNumber;
      }

      // Translate the Guide schema-based JSON to X12 EDI
      const translation = await translateJsonToEdi(
        guideGuideJson,
        guideSummary.guideId,
        envelope
      );

      if (destination.type === "bucket")
        destination.path = `${destination.path}/${isaControlNumber}-${transactionSet}.edi`;

      const result = await deliverToDestination(destination, translation);

      deliveryResults.push(result);
    }

    await markExecutionAsSuccessful(executionId);

    return {
      statusCode: 200,
      deliveryResults,
    };
  } catch (e) {
    const error =
      e instanceof Error ? e : new Error(`unknown error: ${serializeError(e)}`);
    return failedExecution(executionId, error);
  }
};

const determineTransactionSet = (event: OutboudEvent) =>
  event.payload?.heading?.transaction_set_header_ST
    ?.transaction_set_identifier_code_01 ?? event.metadata.transactionSet;
