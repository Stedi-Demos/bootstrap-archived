import fetch from "node-fetch";

// Optional webhook env var for tracking execution progress
const progressTrackingWebhookUrl = process.env["PROGRESS_TRACKING_WEBHOOK_URL"];

export const trackProgress = async (message: string, context?: any): Promise<void> => {
  const payload = {
    message,
    ...context,
  };

  const payloadString = JSON.stringify(payload);
  console.log(payloadString);

  progressTrackingWebhookUrl && await fetch(
    progressTrackingWebhookUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payloadString,
    }
  );
};