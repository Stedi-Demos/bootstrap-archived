import {
  BucketsClient,
  BucketsClientConfig,
  DeleteObjectCommand,
  ListObjectsCommand,
  ObjectListOutput,
} from "@stedi/sdk-client-buckets";

import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _bucketClient: BucketsClient;

export const bucketClient = () => {
  if (_bucketClient === undefined) {
    const config: BucketsClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env["USE_PREVIEW"] !== undefined)
      config.endpoint =
        "https://buckets.cloud.us.preproduction.stedi.com/2022-05-05";

    _bucketClient = new BucketsClient(config);
  }

  return _bucketClient;
};

const deleteItemsWithPrefix = async (
  bucketName: string,
  items: ObjectListOutput[],
  prefix: string
) => {
  const keysToDelete = items?.reduce((keysToDelete: string[], item) => {
    return item.key?.startsWith(prefix)
      ? keysToDelete.concat(item.key)
      : keysToDelete;
  }, []);
  for await (const key of keysToDelete || []) {
    await bucketClient().send(
      new DeleteObjectCommand({
        bucketName,
        key,
      })
    );
  }
};

export const emptyBucket = async (bucketName: string) => {
  const prefix = "";
  const firstPageOfItems = await bucketClient().send(
    new ListObjectsCommand({
      bucketName,
      pageSize: 50,
    })
  );
  let nextPageToken = firstPageOfItems.nextPageToken;
  firstPageOfItems.items &&
    (await deleteItemsWithPrefix(bucketName, firstPageOfItems.items, prefix));
  while (nextPageToken) {
    const bucketItems = await bucketClient().send(
      new ListObjectsCommand({
        bucketName,
        pageSize: 50,
        pageToken: nextPageToken,
      })
    );
    nextPageToken = bucketItems.nextPageToken;
    bucketItems.items &&
      (await deleteItemsWithPrefix(bucketName, bucketItems.items, prefix));
  }
};
