import { GetGuideCommand } from "@stedi/sdk-client-guides";
import { guidesClient } from "./clients/guides.js";

const guides = guidesClient();

type GuideSummary = {
  guideId: string;
  release: string;
};

type ResolveGuideInput = {
  guideIdsForPartnership: string[];
  transactionSetType: string;
  release: string | undefined;
};

export const resolveGuide = async ({
  guideIdsForPartnership,
  transactionSetType,
  release,
}: ResolveGuideInput): Promise<GuideSummary> => {
  let resolvedGuides: GuideSummary[] = [];
  for await (const guideId of guideIdsForPartnership) {
    // deal with raw guide ids or not
    const guideIdsToAttemptToLoad =
      guideId.split("_").length !== 2
        ? [`LIVE_${guideId}`, `DRFT_${guideId}`]
        : [guideId];

    for await (const guideIdToLoad of guideIdsToAttemptToLoad) {
      const guide = await guides.send(
        new GetGuideCommand({ id: guideIdToLoad })
      );

      if (
        guide.id !== undefined &&
        guide.target &&
        guide.target.release &&
        guide.target.transactionSet === transactionSetType
      ) {
        resolvedGuides.push({ guideId, release: guide.target.release });

        // don't check `DRFT_` guide if `LIVE_` matches
        break;
      }
    }
  }

  // if more than one matching guide is found, filter by release
  // (maintains backwards compatibility, we only filter when we have multiple guides with same transaction set)
  if (resolvedGuides.length > 1) {
    resolvedGuides = resolvedGuides.filter((rg) => rg.release === release);
  }

  // if single matching guide is not found, throw an error
  if (resolvedGuides.length !== 1) {
    throw new Error(
      `${resolvedGuides.length} guides resolved for transaction set '${transactionSetType}'.`
    );
  }

  return resolvedGuides[0];
};
