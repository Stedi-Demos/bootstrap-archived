import { EngineFunctionalGroupTranslationSucceededEvent } from "./types.js";
import { stashClient } from "../../../lib/clients/stash.js";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../../lib/constants.js";
import { invokeFunction } from "../../../lib/functions.js";
import { InvocationType } from "@stedi/sdk-client-functions";
import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import {
  DestinationAck,
  DestinationAckSchema,
} from "../../../lib/types/Destination.js";

const stash = stashClient();

export const handler = async (
  event: EngineFunctionalGroupTranslationSucceededEvent
) => {
  const executionId = generateExecutionId(event);
  try {
    await recordNewExecution(executionId, event);
    await send997Acknowledgment(event);
    await markExecutionAsSuccessful(executionId);

    return {};
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);
    return failedExecution(executionId, error);
  }
};

const send997Acknowledgment = async (
  event: EngineFunctionalGroupTranslationSucceededEvent
) => {
  const { partnershipId } = event.detail.partnership;

  const ackConfigResult = await stash.send(
    new GetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `functional_acknowledgments|${partnershipId}`,
    })
  );

  if (!ackConfigResult.value) {
    // acknowledgment not configured
    return;
  }

  const ackConfig: DestinationAck = DestinationAckSchema.parse(
    ackConfigResult.value
  );

  const { functionalIdentifierCode, controlNumber } =
    event.detail.envelopes.functionalGroup;
  const { transactionSetCount, transactionSetIds } = event.detail;

  const { usageIndicatorCode } = event.detail.envelopes.interchange;

  if (
    // eslint-disable-next-line @typescript-eslint/unbound-method
    ackConfig.generateFor.filter(Set.prototype.has, new Set(transactionSetIds))
      .length === 0
  ) {
    // acknowledgments not configured for associated transaction sets
    return;
  }

  await invokeFunction(
    "edi-outbound",
    {
      metadata: {
        transactionSet: "997",
        partnershipId: event.detail.partnership.partnershipId,
        usageIndicatorCode,
        release: event.detail.envelopes.functionalGroup.release,
        useBuiltInGuide: true,
      },
      payload: json997Accepted(
        controlNumber,
        functionalIdentifierCode,
        transactionSetCount
      ),
    },
    InvocationType.ASYNCHRONOUS
  );
};

const json997Accepted = (
  gsControlNumber: number,
  functionalGroupId: string,
  numberOfTransactionSets: number
) => {
  return {
    heading: {
      transaction_set_header_ST: {
        transaction_set_identifier_code_01: "997",
        transaction_set_control_number_02: 1,
      },
      functional_group_response_header_AK1: {
        functional_identifier_code_01: functionalGroupId,
        group_control_number_02: gsControlNumber,
      },
      functional_group_response_trailer_AK9: {
        functional_group_acknowledge_code_01: "A",
        number_of_transaction_sets_included_02: numberOfTransactionSets,
        number_of_received_transaction_sets_03: numberOfTransactionSets,
        number_of_accepted_transaction_sets_04: numberOfTransactionSets,
      },
    },
  };
};
