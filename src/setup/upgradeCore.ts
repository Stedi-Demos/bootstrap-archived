import { upgradeCore } from "../support/core.js";

void (async () => {
  console.log("Starting core upgrade...");

  const result = await upgradeCore();

  if (result) {
    console.log("core is up-to-date.");
  }
})();
