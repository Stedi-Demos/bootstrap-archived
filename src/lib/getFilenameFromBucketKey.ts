import path from "path";

export const getFilenameFromBucketKey = (key: string): string => {
  const keyPathComponents = key.split("/");
  const filename = keyPathComponents.pop();
  if (!filename) {
    throw new Error(`failed to extract filename from key ${key}`);
  }

  return filename;
};

export const getBaseFilenameFromBucketKey = (key: string): string => {
  const fullFilename = getFilenameFromBucketKey(key);
  return path.parse(fullFilename).name;
};
