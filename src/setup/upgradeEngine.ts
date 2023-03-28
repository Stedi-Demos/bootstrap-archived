import { upgradeEngine } from "../support/engine.js";

void (async () => {
  console.log("Starting engine upgrade...");

  const result = await upgradeEngine();

  if (result) {
    console.log("Engine is up-to-date.");
  }
})();
