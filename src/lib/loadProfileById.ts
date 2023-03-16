import {
  GetX12ProfileCommand,
  GetX12ProfileCommandOutput,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "./clients/partners.js";
import { NoUndefined } from "./types/NoUndefined.js";

const partners = partnersClient();

export const loadProfile = async (
  profileId: string
): Promise<NoUndefined<GetX12ProfileCommandOutput>> => {
  return (await partners.send(
    new GetX12ProfileCommand({ profileId })
  )) as NoUndefined<GetX12ProfileCommandOutput>;
};
