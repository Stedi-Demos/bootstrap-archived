import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "../clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../constants.js";
import {
  DestinationCsvToJson,
  destinationCsvToJsonEventsKey,
  DestinationCsvToJsonEventsSchema,
} from "../types/Destination.js";
import { ErrorFromStashConfiguration } from "../errorFromStashConfiguration.js";

const stash = stashClient();

export const loadCsvToJsonDestinations = async (
  bucketName: string,
  key: string
): Promise<DestinationCsvToJson[]> => {
  try {
    const { value } = await stash.send(
      new GetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationCsvToJsonEventsKey,
      })
    );

    if (!value) {
      return [];
    }

    const csvToJsonDestinationParseResult =
      DestinationCsvToJsonEventsSchema.safeParse(value);

    if (!csvToJsonDestinationParseResult.success) {
      throw new ErrorFromStashConfiguration(
        destinationCsvToJsonEventsKey,
        csvToJsonDestinationParseResult
      );
    }

    const destinationCsvToJsonEvents = csvToJsonDestinationParseResult.data;
    return destinationCsvToJsonEvents.destinations.filter((destination) =>
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
  destination: DestinationCsvToJson,
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
