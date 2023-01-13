import { GetGuideCommand } from "@stedi/sdk-client-guides";
import { guidesClient as buildGuideClient } from "../support/guide";

const guidesClient = buildGuideClient();

type GuideSummary = {
  guideId: string;
  release: string;
};

type ResolveGuideInput = {
  guideIdsForPartnership: string[];
  transactionSet: string;
};

export const resolveGuide = async ({
  guideIdsForPartnership,
  transactionSet,
}: ResolveGuideInput): Promise<GuideSummary> => {
  const resolvedGuides: GuideSummary[] = [];
  for await (const guideId of guideIdsForPartnership) {
    // deal with raw guide ids or not
    const guideIdsToAttemptToLoad =
      guideId.split("_").length !== 2
        ? [`LIVE_${guideId}`, `DRFT_${guideId}`]
        : [guideId];

    for await (const guideIdToLoad of guideIdsToAttemptToLoad) {
      const guide = await guidesClient.send(
        new GetGuideCommand({ id: guideIdToLoad })
      );

      if (guide.id !== undefined &&
        guide.target &&
        guide.target.release &&
        guide.target.transactionSet === transactionSet) {
        resolvedGuides.push({ guideId, release: guide.target.release });

        // don't check `DRFT_` guide if `LIVE_` matches
        break;
      }
    }
  }

  // if single matching guide is not found, throw an error
  if (resolvedGuides.length !== 1) {
    throw new Error(`${resolvedGuides.length} guides resolved for transaction set '${transactionSet}'.`);
  }

  return resolvedGuides[0];
};
