import test from "ava";
import { handler } from "../../edi/inbound/handler.js";

const exampleEvent = { "Records": [{ "eventVersion": "2.1", "eventSource": "aws:s3", "awsRegion": "us-east-1", "eventTime": "2023-01-17T07:58:29.455Z", "eventName": "ObjectCreated:Put", "userIdentity": { "principalId": "AWS:AROAQDSINICJGZFFKRNKB:customer-access-role-session-1673942282745" }, "requestParameters": { "sourceIPAddress": "91.206.80.214" }, "responseElements": { "x-amz-request-id": "5GNJ7RJNCW4W0A2J", "x-amz-id-2": "YGSaNOURi3LY5TWP2H5mSfZTnSY1r5gV/NEM50xCyh2VxzoG1PX77G+8KPEVHPDVI7UUzqsLIRHCecwTKRMp++V5ryy0M2eT" }, "s3": { "s3SchemaVersion": "1.0", "configurationId": "OTBlYmM4MTQtZDAwZi00N2EyLWEyZjgtMzVkN2NjMjYxYTM2", "bucket": { "name": "de1eefa7-1bea-4401-a743-3476ddce96a6-sftp", "ownerIdentity": { "principalId": "A1XFZVEBWJBNAH" }, "arn": "arn:aws:s3:::de1eefa7-1bea-4401-a743-3476ddce96a6-sftp" }, "object": { "key": "trading_partners/ANOTHERMERCH/inbound/inbound.edi", "size": 647, "eTag": "2d6bae4aa0f2fc2e5e57617b88d6d9bd", "sequencer": "0063C655256261D75B" } } }] };

test("integration test handler", async (t) => {
  await handler(exampleEvent);
});