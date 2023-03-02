import test from "ava";
import sinon from "sinon";
import sftp from "ssh2-sftp-client";

import {
  mockAs2Client,
  mockBucketClient,
  mockFunctionsClient,
} from "../testing/testHelpers.js";
import { processSingleDelivery } from "../deliveryManager.js";
import nock from "nock";
import { InvokeFunctionCommand } from "@stedi/sdk-client-functions";

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

test("delivery via as2 uploads file to bucket and starts as2 file transfer command", async (t) => {
  const bucketName = "test-as2-bucket";
  const path = "my-as2-trading-partner/outbound";
  const destinationFilename = "850-0001.edi";
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
    destinationFilename,
  });

  t.deepEqual(buckets.calls()[0].args[0].input, {
    bucketName,
    key: `${path}/${destinationFilename}`,
    body: payload,
  });

  t.deepEqual(as2Client.calls()[0].args[0].input, {
    connectorId,
    sendFilePaths: [`/${bucketName}/${path}/${destinationFilename}`],
  });
});

test("delivery via bucket uploads file to bucket in specified path", async (t) => {
  const bucketName = "test-as2-bucket";
  const path = "my-as2-trading-partner/outbound";
  const destinationFilename = "850-0001.edi";
  const payload = "file-contents";

  await processSingleDelivery({
    destination: {
      type: "bucket",
      bucketName,
      path,
    },
    payload,
    destinationFilename,
  });

  t.deepEqual(buckets.calls()[0].args[0].input, {
    bucketName,
    key: `${path}/${destinationFilename}`,
    body: payload,
  });
});

test("delivery via function invokes Stedi function with both payload and additionalInput", async (t) => {
  const functionName = "test-function";
  const payload = "file-contents";
  const additionalInput = {
    extraKey: "extra-value",
  };

  functions.on(InvokeFunctionCommand, { functionName }).resolvesOnce({});

  await processSingleDelivery({
    destination: {
      type: "function",
      functionName,
      additionalInput,
    },
    payload,
    destinationFilename: "unused",
  });

  t.deepEqual(functions.calls()[0].args[0].input, {
    functionName,
    requestPayload: Buffer.from(
      JSON.stringify({
        additionalInput,
        payload,
      })
    ),
  });
});

test("delivery via sftp uploads to remote sftp at expected path", async (t) => {
  const host = "test-host.sftp.com";
  const port = 22;
  const username = "test-user";
  const password = "test-password";
  const remotePath = "/outbound";
  const destinationFilename = "850-0001.edi";
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
    destinationFilename,
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
});

test("delivery via webhook sends payload to expected url", async (t) => {
  const payload = "file-contents";
  const baseUrl = "https://webhook.site";
  const endpoint = "/test-endpoint";
  const url = `${baseUrl}${endpoint}`;

  const webhookRequest = nock(baseUrl)
    .post(endpoint, (body) => t.is(body, payload))
    .reply(200, { thank: "you" });

  await processSingleDelivery({
    destination: {
      type: "webhook",
      verb: "POST",
      url,
    },
    payload,
    destinationFilename: "unused",
  });

  t.assert(webhookRequest.isDone(), "delivered payload to destination webhook");
});
