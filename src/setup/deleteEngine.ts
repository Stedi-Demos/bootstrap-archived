import { deleteEngine } from "../support/engine.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

void (async () => {
  console.log("Preparing to delete engine...");
  await sleep(15_000);
  console.log("Deleting engine...");

  const result = await deleteEngine();
  console.log(result);

  console.log("Engine has been deleted");
})();
