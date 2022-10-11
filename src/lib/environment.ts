export type ResourceType = "bucket" | "guide" | "mapping";

export const requiredEnvVar = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const getResourceIdsForTransactionSets = (transactionSets: string[]): Map<string, { guideId: string, mappingId: string }> => {
  return transactionSets.reduce(
    (resourceIdsMap, transactionSet) => {
      // Transaction set ids from EDI input files do not include the `X12-` resource prefix.
      // When this function is called by the handler to process input files, the prefix gets added.
      const transactionSetId = transactionSet.toUpperCase().startsWith("X12") ? transactionSet : `X12-${transactionSet}`;
      const guideEnvVarName = getEnvVarNameForResource("guide", transactionSetId);
      const mappingEnvVarName = getEnvVarNameForResource("mapping", transactionSetId);
      const guideId = requiredEnvVar(guideEnvVarName);
      const mappingId = requiredEnvVar(mappingEnvVarName);

      return resourceIdsMap.set(transactionSet, { guideId, mappingId });
    }, new Map<string, { guideId: string, mappingId: string}>());
};

export const getEnvVarNameForResource = (resourceType: ResourceType, resourceName: string): string =>
  getEnvVarPrefixForResource(resourceName).concat(getEnvVarSuffixForResourceType(resourceType));

export const getEnvVarPrefixForResource = (resourceName: string) => resourceName.toUpperCase().replace("-", "_");

export const getEnvVarSuffixForResourceType = (resourceType: ResourceType): string =>  `_${resourceType.toUpperCase()}_ID`;