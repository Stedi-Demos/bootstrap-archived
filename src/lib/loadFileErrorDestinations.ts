import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import {
  destinationFileErrorEventsKey,
  DestinationErrorEvents,
  DestinationErrorEventsSchema,
} from "./types/Destination.js";

const stash = stashClient();

export const loadFileErrorDestinations =
  async (): Promise<DestinationErrorEvents> => {
    try {
      const { value } = await stash.send(
        new GetValueCommand({
          keyspaceName: PARTNERS_KEYSPACE_NAME,
          key: destinationFileErrorEventsKey,
        })
      );

      if (!value) {
        return { destinations: [] };
      }

      return DestinationErrorEventsSchema.parse(value);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "ResourceNotFoundException"
      ) {
        return { destinations: [] };
      }
      throw error;
    }
  };
