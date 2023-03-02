import {
  CreateKeyspaceCommand,
  GetKeyspaceCommand,
  GetKeyspaceCommandOutput,
} from "@stedi/sdk-client-stash";
import { stashClient } from "../../lib/clients/stash.js";
import {
  PARTNERS_KEYSPACE_NAME,
  OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
  INBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
} from "../../lib/constants.js";

const stash = stashClient();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureKeyspace = async (keyspaceName: string) => {
  try {
    await stash.send(
      new CreateKeyspaceCommand({
        keyspaceName,
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "KeyspaceAlreadyExistsError"
    )
      console.log(`Keypsace '${keyspaceName}' already exists`);
    else throw error;
  }
};

(async () => {
  console.log("Creating keyspaces...");
  const keyspaceNames = [
    PARTNERS_KEYSPACE_NAME,
    OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
    INBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
  ];

  for (const keyspaceName of keyspaceNames) {
    await ensureKeyspace(keyspaceName);
  }

  for (const keyspaceName of keyspaceNames) {
    let result: Partial<GetKeyspaceCommandOutput> = { status: "UNKNOWN" };
    for (let i = 0; i < 15; i++) {
      result = await stash.send(new GetKeyspaceCommand({ keyspaceName }));

      if (result.status === "ACTIVE") break;

      console.log("Waiting for keyspaces to become active...");

      await sleep(4_000);
    }

    if (result.status !== "ACTIVE")
      throw new Error("Failed to create keyspace");
  }
})();
