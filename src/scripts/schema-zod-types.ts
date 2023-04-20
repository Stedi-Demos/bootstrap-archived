/* eslint-disable @typescript-eslint/no-non-null-assertion */
import acknowledgment from "../schemas/acknowledgment.json" assert { type: "json" };
import destinationAS2 from "../schemas/destination-as2.json" assert { type: "json" };
import destinationBucket from "../schemas/destination-bucket.json" assert { type: "json" };
import destinationFunction from "../schemas/destination-function.json" assert { type: "json" };
import destinationSftp from "../schemas/destination-sftp.json" assert { type: "json" };
import destinationStash from "../schemas/destination-stash.json" assert { type: "json" };
import destinationWebhook from "../schemas/destination-webhook.json" assert { type: "json" };
import errorDestinations from "../schemas/error-destinations.json" assert { type: "json" };
import fs from "node:fs";
import { jsonSchemaToZodDereffed } from "json-schema-to-zod";

// json-schema-to-zod dependency fix resolving child schemas
process.chdir("src/schemas");
await generateZod(acknowledgment, "DestinationAck");
await generateZod(destinationAS2, "DestinationAS2");
await generateZod(destinationBucket, "DestinationBucket");
await generateZod(destinationFunction, "DestinationFunction");
await generateZod(destinationSftp, "DestinationSftp");
await generateZod(destinationStash, "DestinationStash");
await generateZod(destinationWebhook, "DestinationWebhook");
await generateZod(errorDestinations, "ErrorDestinations");

async function generateZod(
  json: unknown,
  name: string,
  destinationFolder = "../lib/types"
) {
  const zodModule = await jsonSchemaToZodDereffed(json as any, name + "Schema");
  const fileName =
    destinationFolder +
    (destinationFolder.endsWith("/") ? "" : "/") +
    `${name}.ts`;
  fs.mkdirSync(destinationFolder, { recursive: true });
  fs.writeFileSync(
    fileName,
    `// generated from /scripts/schema-zod-types.ts#generateZod\n` +
      zodModule +
      `\nexport type ${name} = z.infer<typeof ${name + "Schema"}>;\n`
  );

  console.log(`added zod file: ${fileName}`);
}
