import { GetGuideCommand } from "@stedi/sdk-client-guides";
import { guidesClient as buildGuideClient } from "../support/guide";

const guidesClient = buildGuideClient();

type GuideSummary = {
  guideId: string;
  release: string;
};

type ResolveGuideInput = {
  guideIds: string[];
  transactionSet: string;
};

export const resolveGuide = async ({
  guideIds,
  transactionSet,
}: ResolveGuideInput): Promise<GuideSummary | undefined> => {
  for (const guideId of guideIds) {
    // deal with raw guide ids or not
    let guideIdsToAttempToLoad: string[] = [];
    guideIdsToAttempToLoad =
      guideId.split("_").length !== 2
        ? [`LIVE_${guideId}`, `DRFT_${guideId}`]
        : [guideId];

    for (const guideId of guideIdsToAttempToLoad) {
      const guide = await guidesClient.send(
        new GetGuideCommand({ id: guideId })
      );

      // silence type issues with undefined fields
      if (
        guide.id === undefined ||
        guide.target === undefined ||
        guide.target.release === undefined
      )
        continue;

      if (guide.target.transactionSet === transactionSet)
        return { guideId: guide.id, release: guide.target.release };
    }
  }
};
