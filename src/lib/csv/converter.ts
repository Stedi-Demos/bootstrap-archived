import papaparse from "papaparse";
import { ErrorWithContext } from "../errorWithContext.js";

export const defaultJsonToCsvConversionOptions: papaparse.UnparseConfig = {
  header: true,
  delimiter: ",",
  newline: "\r\n",
};

export const defaultCsvToJsonConversionOptions: papaparse.ParseConfig = {
  header: true,
  skipEmptyLines: true,
  quoteChar: '"',
};

export const convertJsonToCsv = (
  inputJson: unknown[],
  parseConfig?: papaparse.UnparseConfig
): string => {
  const config = parseConfig ?? defaultJsonToCsvConversionOptions;
  return papaparse.unparse(inputJson, config);
};

export const convertCsvToJson = <T>(
  inputCsv: string,
  parseConfig?: papaparse.ParseConfig
): T[] => {
  const config = parseConfig ?? defaultCsvToJsonConversionOptions;
  const result = papaparse.parse(inputCsv, config);

  if (result.errors.length > 0) {
    throw new ErrorWithContext(
      `error${
        result.errors.length > 1 ? "s" : ""
      } encountered converting CSV to JSON`,
      { errors: result.errors }
    );
  }

  return result.data;
};
