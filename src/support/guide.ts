import { serializeError } from "serialize-error";

import {
  CreateGuideCommand,
  CreateGuideInput,
  ListGuidesCommand,
  PublishGuideCommand,
  ResourceConflictException,
} from "@stedi/sdk-client-guides";

import path from "node:path";
import fs from "node:fs";
import { guidesClient } from "../lib/clients/guides.js";

const guides = guidesClient();

export const parseGuideId = (fullGuideId: string): string => {
  return fullGuideId.split("_")[1];
};

export const ensureGuideExists = async (guidePath: string): Promise<string> => {
  const rawGuide = fs.readFileSync(path.join(process.cwd(), guidePath), "utf8");
  const guide = JSON.parse(rawGuide) as CreateGuideInput;

  if (!guide.name) {
    throw new Error(`Guide input must include "name" property`);
  }

  try {
    const guideId = await createGuide(guide);
    const parsedGuideId = parseGuideId(guideId);
    console.log(`Guide created: ${parsedGuideId}`);
    return parsedGuideId;
  } catch (e) {
    if (!(e instanceof ResourceConflictException)) {
      // re-throw all errors except resource conflict
      throw new Error(
        `Error creating guide: ${JSON.stringify(serializeError(e))}`
      );
    }

    console.log(`Guide creation skipped (guide already exists)`);
    const foundGuideId = await findGuideIdByName(guide.name);
    return parseGuideId(foundGuideId);
  }
};

const createGuide = async (guide: CreateGuideInput): Promise<string> => {
  const createGuideResponse = await guides.send(new CreateGuideCommand(guide));

  if (!createGuideResponse.id)
    throw new Error(`Error creating guide (id not found in response)`);

  if (!createGuideResponse.publishedAt) {
    await publishGuide(createGuideResponse.id);
  }

  return createGuideResponse.id;
};

const publishGuide = async (guideId: string): Promise<any> => {
  return await guides.send(
    new PublishGuideCommand({
      id: guideId,
    })
  );
};

const findGuideIdByName = async (
  guideName: string,
  pageToken?: string
): Promise<string> => {
  const guidesList = await guides.send(
    new ListGuidesCommand({
      nextPageToken: pageToken,
    })
  );

  const foundGuide = guidesList.items?.find(
    (guide) => guide.name === guideName
  );

  if (!foundGuide?.id && !guidesList.nextPageToken) {
    throw new Error(`Failed to look up existing guide by name: ${guideName}`);
  }

  return (
    foundGuide?.id ||
    (await findGuideIdByName(guideName, guidesList.nextPageToken))
  );
};
