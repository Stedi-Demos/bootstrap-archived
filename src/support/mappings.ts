import { serializeError } from "serialize-error";

import {
  CreateMappingCommand,
  CreateMappingCommandInput,
  ListMappingsCommand,
} from "@stedi/sdk-client-mappings";

import fs from "node:fs";
import path from "node:path";
import { mappingsClient } from "../lib/mappings.js";

export const ensureMappingExists = async (
  mappingPath: string
): Promise<string> => {
  const rawMapping = fs.readFileSync(
    path.join(process.cwd(), mappingPath),
    "utf8"
  );

  const mapping = JSON.parse(rawMapping) as CreateMappingCommandInput;

  if (!mapping.name) {
    throw new Error(`Mapping input must include "name" property`);
  }

  try {
    return await createMapping(mapping);
  } catch (e) {
    const error = e as any;
    // workaround until Mappings SDK returns the necessary error metadata
    // if (!(e instanceof ResourceConflictException)) {
    if (error.code !== "entity_already_exists") {
      // re-throw all errors except resource conflict
      throw new Error(
        `Error creating mapping: ${JSON.stringify(serializeError(e))}`
      );
    }

    console.log(`Mapping creation skipped (mapping already exists)`);
    return await findMappingIdByName(mapping.name);
  }
};

const createMapping = async (
  mapping: CreateMappingCommandInput
): Promise<string> => {
  const createMappingResponse = await mappingsClient().send(
    new CreateMappingCommand(mapping)
  );

  if (!createMappingResponse.id) {
    throw new Error(`Error creating mapping (id not found in response)`);
  }

  console.log(`Mapping created: ${createMappingResponse.id}`);
  return createMappingResponse.id;
};

const findMappingIdByName = async (
  mappingName: string,
  pageToken?: string
): Promise<string> => {
  const mappingsList = await mappingsClient().send(
    new ListMappingsCommand({
      pageToken,
    })
  );

  const foundMapping = mappingsList.mappings?.find(
    (mapping) => mapping.name === mappingName
  );

  if (!foundMapping?.id && !mappingsList.nextPageToken) {
    throw new Error(
      `Failed to look up existing mapping by name: ${mappingName}`
    );
  }

  return (
    foundMapping?.id ||
    (await findMappingIdByName(mappingName, mappingsList.nextPageToken))
  );
};
