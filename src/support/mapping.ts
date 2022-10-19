import { serializeError } from "serialize-error";

import {
  CreateMappingCommand,
  CreateMappingCommandInput,
  ListMappingsCommand,
  MappingsClient
} from "@stedi/sdk-client-mappings";

import { DEFAULT_SDK_CLIENT_PROPS } from "../lib/constants.js";

let _mappingsClient: MappingsClient;

export const mappingsClient = (): MappingsClient => {
  if (_mappingsClient == undefined) {
    _mappingsClient = new MappingsClient({
      ...DEFAULT_SDK_CLIENT_PROPS,
      endpoint: "https://mappings.us.stedi.com/2021-06-01",
    });

  }

  return _mappingsClient;
};

export const ensureMappingExists = async (namespace: string, mapping: CreateMappingCommandInput): Promise<string> => {
  if (!mapping.name) {
    throw new Error(`[${namespace}] Mapping input must include "name" property`);
  }

  try {
    return await createMapping(namespace, mapping);
  } catch (e) {
    const error = e as any;
    // workaround until Mappings SDK returns the necessary error metadata
    // if (!(e instanceof ResourceConflictException)) {
    if (error.code !== "entity_already_exists") {
      // re-throw all errors except resource conflict
      throw new Error(`[${namespace}] Error creating mapping: ${JSON.stringify(serializeError(e))}`);
    }

    console.log(`[${namespace}] Mapping creation skipped (mapping already exists)`);
    return await findMappingIdByName(namespace, mapping.name);
  }
};

const createMapping = async (namespace: string, mapping: CreateMappingCommandInput): Promise<string> => {
  const createMappingResponse = await mappingsClient().send(new CreateMappingCommand(mapping));

  if (!createMappingResponse.id) {
    throw new Error(`[${namespace}] Error creating mapping (id not found in response)`);
  }

  console.log(`[${namespace}] Mapping created: ${createMappingResponse.id}`);
  return createMappingResponse.id;
};

const findMappingIdByName = async (namespace: string, mappingName: string, pageToken?: string): Promise<string> => {
  const mappingsList = await mappingsClient().send(new ListMappingsCommand({
    pageToken,
  }));

  const foundMapping = mappingsList.mappings?.find((mapping=> mapping.name === mappingName));

  if (!foundMapping?.id && !mappingsList.nextPageToken) {
    throw new Error(`[${namespace}] Failed to look up existing mapping by name: ${mappingName}`);
  }

  return foundMapping?.id || await findMappingIdByName(namespace, mappingName, mappingsList.nextPageToken);
};