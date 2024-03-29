import test from "ava";
import sinon from "sinon";
import sftp from "ssh2-sftp-client";

import {
  mockAs2Client,
  mockBucketClient,
  mockFunctionsClient,
} from "../testing/testHelpers.js";
import { PayloadMetadata, processSingleDelivery } from "../deliveryManager.js";
import nock from "nock";
import { InvokeFunctionCommand } from "@stedi/sdk-client-functions";
import { DestinationSftp } from "../types/DestinationSftp.js";

const as2Client = mockAs2Client();
const buckets = mockBucketClient();
const functions = mockFunctionsClient();
const sftpStub = sinon.stub(sftp.prototype);

test.before(() => {
  nock.disableNetConnect();
});

test.afterEach.always(() => {
  as2Client.reset();
  buckets.reset();
  functions.reset();
  sinon.reset();
});

test.serial(
  "delivery via as2 uploads file to bucket and starts as2 file transfer command",
  async (t) => {
    const bucketName = "test-as2-bucket";
    const path = "my-as2-trading-partner/outbound";
    const payloadMetadata: PayloadMetadata = {
      payloadId: "850-0001",
      format: "edi",
    };
    const destinationFilename = `${payloadMetadata.payloadId}.${payloadMetadata.format}`;
    const connectorId = "my-as2-connector-id";
    const payload = "file-contents";

    await processSingleDelivery({
      destination: {
        type: "as2",
        bucketName,
        path,
        connectorId,
      },
      payload: "file-contents",
      payloadMetadata,
    });

    t.deepEqual(buckets.calls()[0]!.args[0].input, {
      bucketName,
      key: `${path}/${destinationFilename}`,
      body: payload,
    });

    t.deepEqual(as2Client.calls()[0]!.args[0].input, {
      connectorId,
      sendFilePaths: [`/${bucketName}/${path}/${destinationFilename}`],
    });
  }
);

test.serial(
  "delivery via bucket uploads file to bucket in specified path",
  async (t) => {
    const bucketName = "test-as2-bucket";
    const path = "my-as2-trading-partner/outbound";
    const payloadMetadata: PayloadMetadata = {
      payloadId: "850-0001",
      format: "edi",
    };
    const destinationFilename = `${payloadMetadata.payloadId}.${payloadMetadata.format}`;
    const payload = "file-contents";

    await processSingleDelivery({
      destination: {
        type: "bucket",
        bucketName,
        path,
      },
      payload,
      payloadMetadata,
    });

    t.deepEqual(buckets.calls()[0]!.args[0].input, {
      bucketName,
      key: `${path}/${destinationFilename}`,
      body: payload,
    });
  }
);

test.serial(
  "delivery via bucket includes baseFilename when specified",
  async (t) => {
    const bucketName = "test-as2-bucket";
    const path = "my-as2-trading-partner/outbound";
    const payloadMetadata: PayloadMetadata = {
      payloadId: "850-0001",
      format: "edi",
    };
    const baseFilename = "my-base-filename";
    const destinationFilename = `${payloadMetadata.payloadId}-${baseFilename}.${payloadMetadata.format}`;
    const payload = "file-contents";

    await processSingleDelivery({
      destination: {
        type: "bucket",
        bucketName,
        path,
        baseFilename,
      },
      payload,
      payloadMetadata,
    });

    t.deepEqual(buckets.calls()[0]!.args[0].input, {
      bucketName,
      key: `${path}/${destinationFilename}`,
      body: payload,
    });
  }
);

test.serial(
  "delivery via bucket removes preceding slashes from bucket path",
  async (t) => {
    const bucketName = "test-as2-bucket";
    const path = "//my-as2-trading-partner/outbound";
    const payloadMetadata: PayloadMetadata = {
      payloadId: "850-0001",
      format: "edi",
    };
    const destinationFilename = `${payloadMetadata.payloadId}.${payloadMetadata.format}`;
    const payload = "file-contents";

    await processSingleDelivery({
      destination: {
        type: "bucket",
        bucketName,
        path,
      },
      payload,
      payloadMetadata,
    });

    const expectedPath = "my-as2-trading-partner/outbound";
    t.deepEqual(buckets.calls()[0]!.args[0].input, {
      bucketName,
      key: `${expectedPath}/${destinationFilename}`,
      body: payload,
    });
  }
);

test.serial(
  "delivery via bucket uses file extension if specified",
  async (t) => {
    const bucketName = "test-as2-bucket";
    const path = "my-as2-trading-partner/outbound";
    const payloadMetadata: PayloadMetadata = {
      payloadId: "850-0001",
      format: "edi",
    };
    const destinationFilename = `${payloadMetadata.payloadId}.DAT`;
    const payload = "file-contents";

    await processSingleDelivery({
      destination: {
        type: "bucket",
        bucketName,
        path,
        fileExtension: "DAT",
      },
      payload,
      payloadMetadata,
    });

    const expectedPath = "my-as2-trading-partner/outbound";
    t.deepEqual(buckets.calls()[0]!.args[0].input, {
      bucketName,
      key: `${expectedPath}/${destinationFilename}`,
      body: payload,
    });
  }
);

test.serial(
  "delivery via function fails when payload is string but additionalInput object is configured",
  async (t) => {
    const functionName = "test-function";
    const payload = "file-contents";
    const additionalInput = {
      extraKey: "extra-value",
    };

    await t.throwsAsync(
      async () =>
        await processSingleDelivery({
          destination: {
            type: "function",
            functionName,
            additionalInput,
          },
          payload,
          payloadMetadata: {
            payloadId: "some-id",
            format: "json",
          },
        }),
      {
        instanceOf: Error,
        message:
          "additionalInput for function destination not supported with string payload",
      }
    );
  }
);

test.serial(
  "delivery via function invokes Stedi function with payload with no additionalInput",
  async (t) => {
    const functionName = "test-function";
    const payload = { key: "value" };

    functions.on(InvokeFunctionCommand, { functionName }).resolvesOnce({});

    await processSingleDelivery({
      destination: {
        type: "function",
        functionName,
      },
      payload,
      payloadMetadata: {
        payloadId: "some-id",
        format: "json",
      },
    });

    t.deepEqual(functions.calls()[0]!.args[0].input, {
      functionName,
      invocationType: "Synchronous",
      payload,
    });
  }
);

test.serial(
  "delivery via function invokes Stedi function with both payload and additionalInput",
  async (t) => {
    const functionName = "test-function";
    const payload = { key: "value" };
    const additionalInput = { extraKey: "extra-value" };

    functions.on(InvokeFunctionCommand, { functionName }).resolvesOnce({});

    await processSingleDelivery({
      destination: {
        type: "function",
        functionName,
        additionalInput,
      },
      payload,
      payloadMetadata: {
        payloadId: "some-id",
        format: "json",
      },
    });

    t.deepEqual(functions.calls()[0]!.args[0].input, {
      functionName,
      invocationType: "Synchronous",
      payload: {
        ...payload,
        ...additionalInput,
      },
    });
  }
);

test.serial(
  "delivery via sftp uploads to remote sftp at expected path",
  async (t) => {
    const host = "test-host.sftp.com";
    const port = 22;
    const username = "test-user";
    const password = "test-password";
    const remotePath = "/outbound";
    const payloadMetadata: PayloadMetadata = {
      payloadId: "850-0001",
      format: "edi",
    };
    const destinationFilename = `${payloadMetadata.payloadId}.${payloadMetadata.format}`;
    const payload = "file-contents";

    await processSingleDelivery({
      destination: {
        type: "sftp",
        connectionDetails: {
          host,
          port,
          username,
          password,
        },
        remotePath,
      },
      payloadMetadata,
      payload,
    });

    t.assert(
      sftpStub.connect.calledOnceWith({
        host,
        port,
        username,
        password,
      })
    );
    t.assert(
      sftpStub.put.calledOnceWith(
        Buffer.from(payload),
        `${remotePath}/${destinationFilename}`
      )
    );
    t.assert(sftpStub.end.calledOnceWith());
  }
);

test.serial(
  "delivery via sftp includes privateKey and passphrase when connecting if included in config",
  async (t) => {
    const host = "test-host.sftp.com";
    const port = 22;
    const username = "test-user";
    const password = "test-password";
    const privateKey = "some-private-key-value";
    const passphrase = "private-key-passphrase";
    const remotePath = "/outbound";
    const payloadMetadata: PayloadMetadata = {
      payloadId: "850-0001",
      format: "edi",
    };
    const destinationFilename = `${payloadMetadata.payloadId}.${payloadMetadata.format}`;
    const payload = "file-contents";

    await processSingleDelivery({
      destination: {
        type: "sftp",
        connectionDetails: {
          host,
          port,
          username,
          password,
          privateKey,
          passphrase,
        },
        remotePath,
      },
      payloadMetadata,
      payload,
    });

    t.assert(
      sftpStub.connect.calledOnceWith({
        host,
        port,
        username,
        password,
        privateKey,
        passphrase,
      })
    );
    t.assert(
      sftpStub.put.calledOnceWith(
        Buffer.from(payload),
        `${remotePath}/${destinationFilename}`
      )
    );
    t.assert(sftpStub.end.calledOnceWith());
  }
);

test.serial(
  "delivery via sftp includes retries, timeouts, and algorithms when connecting if included in config",
  async (t) => {
    const host = "test-host.sftp.com";
    const port = 22;
    const username = "test-user";
    const password = "test-password";
    const remotePath = "/outbound";
    const payloadMetadata: PayloadMetadata = {
      payloadId: "850-0001",
      format: "edi",
    };
    const destinationFilename = `${payloadMetadata.payloadId}.${payloadMetadata.format}`;
    const payload = "file-contents";
    const retries = 2;
    const readyTimeout = 1_000;
    const timeout = 2_000;
    const algorithms: DestinationSftp["connectionDetails"]["algorithms"] = {
      kex: ["diffie-hellman-group18-sha512"],
      serverHostKey: ["rsa-sha2-512"],
      cipher: ["aes256-gcm"],
      hmac: ["hmac-sha2-512"],
      compress: ["zlib"],
    };

    await processSingleDelivery({
      source: undefined,
      destination: {
        type: "sftp",
        connectionDetails: {
          host,
          port,
          username,
          password,
          retries,
          readyTimeout,
          timeout,
          algorithms,
        },
        remotePath,
      },
      payloadMetadata,
      payload,
    });

    t.assert(
      sftpStub.connect.calledOnceWith({
        host,
        port,
        username,
        password,
        retries,
        readyTimeout,
        timeout,
        algorithms,
      })
    );
    t.assert(
      sftpStub.put.calledOnceWith(
        Buffer.from(payload),
        `${remotePath}/${destinationFilename}`
      )
    );
    t.assert(sftpStub.end.calledOnceWith());
  }
);

test.serial("delivery via webhook sends payload to expected url", async (t) => {
  const payload = "file-contents";
  const baseUrl = "https://webhook.site";
  const endpoint = "/test-endpoint";
  const url = `${baseUrl}${endpoint}`;

  const webhookRequest = nock(baseUrl)
    .post(endpoint, (body) => t.is(body, payload))
    .reply(200, { thank: "you" });

  await processSingleDelivery({
    source: undefined,
    destination: {
      type: "webhook",
      verb: "POST",
      url,
    },
    payload,
    payloadMetadata: {
      payloadId: "some-id",
      format: "json",
    },
  });

  t.assert(webhookRequest.isDone(), "delivered payload to destination webhook");
});

test.serial(
  "delivery via webhook with additional input adds EDI to the payload property",
  async (t) => {
    const payload = "file-contents";
    const baseUrl = "https://webhook.site";
    const endpoint = "/test-endpoint";
    const url = `${baseUrl}${endpoint}`;

    const webhookRequest = nock(baseUrl)
      .post(
        endpoint,
        (body) => t.is(body.payload, payload) && t.is(body.additional, "input")
      )
      .reply(200, { thank: "you" });

    await processSingleDelivery({
      source: undefined,
      destination: {
        type: "webhook",
        verb: "POST",
        url,
        additionalInput: {
          additional: "input",
        },
      },
      payload,
      payloadMetadata: {
        payloadId: "some-id",
        format: "json",
      },
    });

    t.assert(
      webhookRequest.isDone(),
      "delivered payload to destination webhook"
    );
  }
);

test.serial(
  "delivery via webhook with additional input and guide json creates body with additional input as top-level properties",
  async (t) => {
    const payload = { content: "file-contents" };
    const baseUrl = "https://webhook.site";
    const endpoint = "/test-endpoint";
    const url = `${baseUrl}${endpoint}`;

    const webhookRequest = nock(baseUrl)
      .post(
        endpoint,
        (body) =>
          t.is(body.content, "file-contents") && t.is(body.additional, "input")
      )
      .reply(200, { thank: "you" });

    await processSingleDelivery({
      source: undefined,
      destination: {
        type: "webhook",
        verb: "POST",
        url,
        additionalInput: {
          additional: "input",
        },
      },
      payload,
      payloadMetadata: {
        payloadId: "some-id",
        format: "json",
      },
    });

    t.assert(
      webhookRequest.isDone(),
      "delivered payload to destination webhook"
    );
  }
);
