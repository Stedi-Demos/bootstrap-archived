import { PutObjectCommand } from "@stedi/sdk-client-buckets";
import { bucketClient } from "./buckets";
import { translateClient } from "./translateV3";
import hash from "object-hash";

const client = bucketClient();
const translate = translateClient();;
const accountId = "${accountId}";

export interface TransactionContext {
  documents: { transactionSets?: {}[]; }[];
  executionStartTime?: number;
  executionEndTime?: number;
  executionInput?: {};
  executionSucceed?: true;
  executionId?: string;
  functionName?: string;
  accountId?: string;
}


export const wrap = (handler: (event: any, context: TransactionContext) => Promise<Record<string, any>>) => {
  return async (event: any, lambdaContext: { awsRequestId: string; }) => {
    const context: TransactionContext = {
      documents: [],
      executionStartTime: Date.now(),
      executionId: lambdaContext.awsRequestId,
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      accountId: "de1eefa7-1bea-4401-a743-3476ddce96a6",
      executionInput: event
    };

    let response = undefined;
    let error = undefined;
    try {
      response = await handler(event, context);
      context.executionSucceed = true;
    } catch (err) {
      error = err;
    }
    context.executionEndTime = Date.now();
    console.log("flush", context);
    try {
      await flush(context);
    } catch (err) {
      console.log({ message: "error flushing context", err });
    }

    if (error) {
      throw error;
    }
    return response;
  };


};

const flush = async (context: TransactionContext) => {

  let executionUrl: string | undefined;
  if (context.executionId) {
    const execution = {
      "function": `https://www.stedi.com/app/functions/${context.functionName}/edit?account=${context.accountId}`,
      "succeeded": !!context.executionSucceed,
      "logs": `https://www.stedi.com/app/functions/logs?account=${context.accountId}#function=${context.functionName},tab=logs,from=${context.executionStartTime},until=${context.executionEndTime}`,
      "input": context.executionInput,
    };
    const future = new Date(2030, 1, 1).getDate();
    const sortThing = String(future - Date.now()).substring(1);
    const key = `executions/${context.functionName}/${sortThing}`;

    await client.send(new PutObjectCommand({
      bucketName: `${context.accountId}-logs`,
      key,
      body: JSON.stringify(execution, null, 2),
    }));

    const encoded = key.replace("/", "%2F");

    executionUrl = `https://www.stedi.com/app/buckets/${context.accountId}-logs?account=${context.accountId}&object=${encoded}&prefix=executions%2F`;
  }

  for (let document of context.documents) {
    if (!document.transactionSets?.length) {
      document = { transactionSets: [document] };
    }
    for (const transactionSet of (document.transactionSets || [])) {
      const transaction_set_identifier_code_01 = findValues(transactionSet, "transaction_set_identifier_code_01").at(0);
      if (transaction_set_identifier_code_01 === "850") {
        const purchase_order_number_03 = findValues(transactionSet, "purchase_order_number_03").at(0);
        if (purchase_order_number_03)
          await client.send(new PutObjectCommand({
            bucketName: `${context.accountId}-logs`,
            key: `purchase-orders/${purchase_order_number_03}`,
            body: JSON.stringify({
              execution: executionUrl,
              source: transactionSet,
              acknowledgements: `https://www.stedi.com/app/buckets/${context.accountId}-logs?account=${context.accountId}&prefix=purchase-orders%2F${purchase_order_number_03}%2Facknowledgements%2F`,
            }, null, 2),
          }));
      }
      if (transaction_set_identifier_code_01 === "855") {
        const purchase_order_number_03 = findValues(transactionSet, "purchase_order_number_03").at(0);

        if (purchase_order_number_03) {
          const acknowledgementId = hash(transactionSet);
          await client.send(new PutObjectCommand({
            bucketName: `${context.accountId}-logs`,
            key: `purchase-orders/${purchase_order_number_03}/acknowledgements/${acknowledgementId}`,
            body: JSON.stringify({
              purchaseOrder: `https://www.stedi.com/app/buckets/${context.accountId}-logs?account=${context.accountId}&object=purchase-orders%2F${purchase_order_number_03}&prefix=purchase-orders%2F`,
              source: transactionSet,
              execution: executionUrl
            }, null, 2),
          }));
        }
      }

    }
  }
};

const findValues = (obj: {}, key: string): string[] => {
  const result: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "object" && v) {
      if (!v) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          result.push(...findValues(item, key));
        }
      } else {
        result.push(...findValues(v, key));
      }
    } else {
      if (k === key) {
        result.push(String(v));
      }
    }
  }
  return result;
};


// export const purchaseOrderAppendInputJson = (purchaseOrderId: string, purchaseOrder: {}) => {

// };

// export const purchaseOrderAppendInputJson = (purchaseOrderId: string, purchaseOrder: {}) => {

// };;
