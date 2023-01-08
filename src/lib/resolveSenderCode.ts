import { Partnership } from "./types/PartnerRouting";

export const resolveSenderCode = (
  partnership: Partnership,
  partnerId: string
): string => {
  const appId = partnership.applicationIds[partnerId];

  if (appId === undefined)
    throw new Error(`No application id found for '${partnerId}'`);

  return appId;
};
