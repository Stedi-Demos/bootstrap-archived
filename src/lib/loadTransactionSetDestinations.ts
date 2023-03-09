import {
  GetValueCommand,
  StashClient,
  StashClientConfig,
} from "@stedi/sdk-client-stash";
import {
  DEFAULT_SDK_CLIENT_PROPS,
  PARTNERS_KEYSPACE_NAME,
} from "./constants.js";
import {
  TransactionSetDestinations,
  TransactionSetDestinationsSchema,
} from "./types/Destination.js";

export const loadTransactionSetDestinations = async (
  transactionRuleId: string
): Promise<TransactionSetDestinations> => {
  console.log({
    keyspaceName: PARTNERS_KEYSPACE_NAME,
    key: `destinations|${transactionRuleId}`,
  });

  const config: StashClientConfig = {
    ...DEFAULT_SDK_CLIENT_PROPS,
  };

  if (process.env["USE_PREVIEW"] !== undefined)
    config.endpoint = "https://stash.us.preproduction.stedi.com/2022-04-20";

  console.log({ config });

  const stashClient = new StashClient(config);

  try {
    const { value } = await stashClient.send(
      new GetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `destinations|${transactionRuleId}`,
      })
    );

    return TransactionSetDestinationsSchema.parse(value);
  } catch (error) {
    console.error(error);
    return { destinations: [] };
  }
};
