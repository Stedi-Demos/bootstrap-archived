import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";
import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";

let _mappingsClient: MappingsClient;

export const mappingsClient = (): MappingsClient => {
  if (_mappingsClient == undefined) {
    _mappingsClient = new MappingsClient(DEFAULT_SDK_CLIENT_PROPS);
  }

  return _mappingsClient;
};

export const invokeMapping = async (mappingId: string, payload: any): Promise<any> => {
  // Execute mapping to transform API JSON input to Guide schema-based JSON
  const mapResult = await mappingsClient().send(
    new MapDocumentCommand({
      id: mappingId,
      content: payload,
    })
  );
  console.log(`mapping result: ${JSON.stringify(mapResult)}`);

  if (!mapResult.content) {
    throw new Error(`map (id=${mappingId}) operation did not return any content`);
  }

  return mapResult.content;
};