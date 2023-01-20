import { GetValueCommand, SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "../lib/stash.js";
import {
  BootstrapMetadata,
  BootstrapMetadataSchema,
} from "../lib/types/BootstrapMetadata.js";

export const getOrInitMetadata = async (): Promise<BootstrapMetadata> => {
  const bootstrapMetadata = await stashClient().send(
    new GetValueCommand({
      keyspaceName: "partners-configuration",
      key: "bootstrap|metadata",
    })
  );
  return BootstrapMetadataSchema.parse(
    bootstrapMetadata.value ?? { resources: {} }
  );
};

export const updateResourceMetadata = async (
  resources: BootstrapMetadata["resources"]
): Promise<void> => {
  const { resources: existingResources } = await getOrInitMetadata();
  await stashClient().send(
    new SetValueCommand({
      keyspaceName: "partners-configuration",
      key: "bootstrap|metadata",
      value: { resources: { ...existingResources, ...resources } },
    })
  );
};
