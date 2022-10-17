export type ResourceType = "bucket" | "guide" | "mapping";

export const requiredEnvVar = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const getResourceIdsForTransactionSets = (transactionSets: string[]): Map<string, { guideId: string, mappingId: string }> => {
  return transactionSets.reduce(
    (resourceIdsMap, transactionSet) => {
      const guideEnvVarName = getEnvVarNameForResource("guide", transactionSet);
      const mappingEnvVarName = getEnvVarNameForResource("mapping", transactionSet);
      const guideId = requiredEnvVar(guideEnvVarName);
      const mappingId = requiredEnvVar(mappingEnvVarName);

      return resourceIdsMap.set(transactionSet, { guideId, mappingId });
    }, new Map<string, { guideId: string, mappingId: string}>());
};

export const getEnvVarNameForResource = (resourceType: ResourceType, resourceName: string): string =>
  getEnvVarPrefixForResource(resourceName).concat(getEnvVarSuffixForResourceType(resourceType));

export const getEnvVarPrefixForResource = (resourceName: string) => resourceName.toUpperCase().replace(/-/g, "_");

export const getEnvVarSuffixForResourceType = (resourceType: ResourceType): string =>  `_${resourceType.toUpperCase()}_ID`;