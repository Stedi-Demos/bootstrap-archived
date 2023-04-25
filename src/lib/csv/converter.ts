import papaparse from "papaparse";

export const defaultJsonToCsvConversionOptions: papaparse.UnparseConfig = {
  header: true,
  delimiter: ",",
  newline: "\r\n",
};

export const convertJsonToCsv = (
  inputJson: unknown[],
  parseConfig?: papaparse.UnparseConfig
): string => {
  const config = parseConfig ?? defaultJsonToCsvConversionOptions;
  return papaparse.unparse(inputJson, config);
};
