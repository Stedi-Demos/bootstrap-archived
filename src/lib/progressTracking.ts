import fetch from "node-fetch";
import * as cloudwatch from "@aws-sdk/client-cloudwatch-logs";

// Optional webhook env var for tracking execution progress
const progressTrackingWebhookUrl = process.env["PROGRESS_TRACKING_WEBHOOK_URL"];
const awsAccountId = process.env["AWS_ACCOUNT_ID"] ?? "";

async function sendToCloudwatch(message: string, executionId: string) {
  const cwClient = new cloudwatch.CloudWatchLogsClient({});

  // check if we have already created a log group for this execution ID
  const command = new cloudwatch.DescribeLogGroupsCommand({
    accountIdentifiers: [awsAccountId],
    logGroupNamePrefix: executionId,
  });
  const response = await cwClient.send(command);
  // if a log group exists create a new log stream with the payload
  if (response.logGroups) {
    const logGroupId = response.logGroups?.[0].logGroupName ?? executionId;
    const logStreamName = `${Date.now()}_${logGroupId}`
    const createCommand = new cloudwatch.CreateLogStreamCommand({
      logGroupName: logGroupId,
      logStreamName,
    });
    const createResponse = await cwClient.send(createCommand);
    // send the message to the new log stream 
    new cloudwatch.PutLogEventsCommand({
      logGroupName: logGroupId,
      logStreamName,
      logEvents: [{ timestamp: Date.now(), message }],
    });
  }
}

export const trackProgress = async (
  message: string,
  context?: any
): Promise<void> => {
  const payload = {
    message,
    ...context,
  };

  const payloadString = JSON.stringify(payload);
  console.log(payloadString);

  progressTrackingWebhookUrl &&
    (await fetch(progressTrackingWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payloadString,
    }));

  if (context.executionId) {
    await sendToCloudwatch(payloadString, context.executionId);
  }
};
