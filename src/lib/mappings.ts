import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";
import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";
import { DocumentType } from "@aws-sdk/types";
import { ErrorWithContext } from "./errorWithContext.js";

let _mappingsClient: MappingsClient | undefined;

export const mappingsClient = (): MappingsClient => {
  if (_mappingsClient == undefined) {
    _mappingsClient = new MappingsClient(DEFAULT_SDK_CLIENT_PROPS);
  }

  return _mappingsClient;
};

export const invokeMapping = async (
  mappingId: string,
  payload: unknown
): Promise<object> => {
  // Execute mapping to transform API JSON input to Guide schema-based JSON
  try {
    const mapResult = await mappingsClient().send(
      new MapDocumentCommand({
        id: mappingId,
        content: payload as DocumentType,
      })
    );
    console.log(`mapping result: ${JSON.stringify(mapResult)}`);

    if (!mapResult.content) {
      throw new Error(
        `map (id=${mappingId}) operation did not return any content`
      );
    }

    // temporarily remove empty objects from mapping result until $omitField is updated to work on objects
    return removeEmptyObjects(mapResult.content) as object;
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "name" in e &&
      e.name === "ForbiddenException"
    ) {
      throw new Error(
        "Mapping request blocked. Detected potentially malicious payload."
      );
    }
    throw new ErrorWithContext("Mapping request failed", { originalError: e });
  }
};

export const removeEmptyObjects = (input: unknown): unknown => {
  // return the input if it is not an object
  if (typeof input !== "object") {
    return input;
  }

  // return the input if either of the following apply:
  // - it is null/undefined
  // - it is an object with no keys, but has a constructor other than the Object constructor (such as a Date)
  if (
    !input ||
    (Object.keys(input).length === 0 && input.constructor !== Object)
  ) {
    return input;
  }

  // remove empty objects from arrays (empty arrays are not modified)
  if (Array.isArray(input)) {
    return input.map(removeEmptyObjects).filter((item) => item);
  }

  // otherwise, loop through all properties of the object and recursively remove empty objects
  const filteredObjectEntries = Object.entries(input).reduce(
    (entries: [string, unknown][], [key, value]) => {
      const filteredValue = removeEmptyObjects(value);
      return filteredValue !== undefined
        ? // use nested array notation `[[key, value]]` to concat key/value tuple to array
          entries.concat([[key, filteredValue]])
        : entries;
    },
    []
  );

  // if there are any non-empty entries after filtering, reconstruct the object,
  // otherwise remove the object from the tree
  return filteredObjectEntries.length !== 0
    ? Object.fromEntries(filteredObjectEntries)
    : undefined;
};
