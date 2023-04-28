import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "../clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../constants.js";
import {
  DestinationCsvFromJson,
  destinationCsvFromJsonEventsKey,
  DestinationCsvFromJsonEventsSchema,
} from "../types/Destination.js";
import { ErrorFromStashConfiguration } from "../errorFromStashConfiguration.js";

const stash = stashClient();

export const loadCsvFromJsonDestinations = async (
  bucketName: string,
  key: string
): Promise<DestinationCsvFromJson[]> => {
  try {
    const { value } = await stash.send(
      new GetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationCsvFromJsonEventsKey,
      })
    );

    if (!value) {
      return [];
    }

    const csvFromJsonDestinationParseResult =
      DestinationCsvFromJsonEventsSchema.safeParse(value);

    if (!csvFromJsonDestinationParseResult.success) {
      throw new ErrorFromStashConfiguration(
        destinationCsvFromJsonEventsKey,
        csvFromJsonDestinationParseResult
      );
    }

    const destinationCsvFromJsonEvents = csvFromJsonDestinationParseResult.data;
    return destinationCsvFromJsonEvents.destinations.filter((destination) =>
      filterDestination(destination, bucketName, key)
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    ) {
      return [];
    }
    throw error;
  }
};

const filterDestination = (
  destination: DestinationCsvFromJson,
  bucketName: string,
  key: string
): boolean => {
  const bucketMatch = destination.filter?.bucketName
    ? destination.filter.bucketName === bucketName
    : true;

  const keyPrefixMatch = destination.filter?.pathPrefix
    ? key.startsWith(destination.filter.pathPrefix)
    : true;

  return bucketMatch && keyPrefixMatch;
};
