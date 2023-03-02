import {
  DeleteObjectCommand,
  ListObjectsCommand,
  ObjectListOutput,
} from "@stedi/sdk-client-buckets";
import { bucketsClient } from "./clients/buckets.js";

const buckets = bucketsClient();

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
    await buckets.send(
      new DeleteObjectCommand({
        bucketName,
        key,
      })
    );
  }
};

export const emptyBucket = async (bucketName: string) => {
  const prefix = "";
  const firstPageOfItems = await buckets.send(
    new ListObjectsCommand({
      bucketName,
      pageSize: 50,
    })
  );
  let nextPageToken = firstPageOfItems.nextPageToken;
  firstPageOfItems.items &&
    (await deleteItemsWithPrefix(bucketName, firstPageOfItems.items, prefix));
  while (nextPageToken) {
    const bucketItems = await buckets.send(
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
