export type ResourceType = "bucket" | "guide" | "mapping";

export const requiredEnvVar = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const getEnvVarNameForResource = (resourceType: ResourceType, resourceName: string): string =>
  getEnvVarPrefixForResource(resourceName).concat(getEnvVarSuffixForResourceType(resourceType));

export const getEnvVarPrefixForResource = (resourceName: string) => resourceName.toUpperCase().replace("-", "_");

export const getEnvVarSuffixForResourceType = (resourceType: ResourceType): string =>  `_${resourceType.toUpperCase()}_ID`;