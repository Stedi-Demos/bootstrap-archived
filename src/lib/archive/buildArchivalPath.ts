export const buildArchivalPath = ({
  currentKey,
}: {
  currentKey: string;
}): string => {
  const timestamp = new Date().toISOString();
  const [year, month, day] = timestamp.split(/[-T]/);

  const currentKeyParts = currentKey.split("/");
  const currentFilenameParts = currentKeyParts.pop()!.split(".");

  let filename: string;
  if (currentFilenameParts.length > 1) {
    const extension = currentFilenameParts.pop();
    const filenameWithoutExtension = currentFilenameParts.join(".");
    filename = `${currentKeyParts.join(
      "/"
    )}/${filenameWithoutExtension}_${timestamp}.${extension}`;
  } else {
    filename = `${currentFilenameParts[0]}_${timestamp}`;
  }

  return `archive/${year}/${month}/${day}/${filename}`;
};
