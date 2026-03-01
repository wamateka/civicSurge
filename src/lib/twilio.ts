let twilioClient: any = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  try {
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
  } catch {
    return null;
  }
}

export async function sendSMS(to: string, body: string): Promise<void> {
  const client = getTwilioClient();

  if (!client) {
    console.log(`[SMS SKIPPED - no credentials] To: ${to}`);
    console.log(`[SMS Content] ${body}`);
    return;
  }

  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    });
    console.log(`[SMS SENT] To: ${to}`);
  } catch (error) {
    console.error(`[SMS ERROR] To: ${to}`, error);
  }
}

export function buildMobilizationSMS(
  volunteerName: string,
  eventTitle: string,
  eventType: string,
  appUrl: string,
  deploymentId: string
): string {
  return (
    `🚨 CIVICSURGE ALERT 🚨\n` +
    `Hi ${volunteerName}, you're needed for:\n` +
    `${eventType} EMERGENCY: ${eventTitle}\n\n` +
    `Respond now: ${appUrl}/dashboard/volunteer\n` +
    `Deployment ID: ${deploymentId}`
  );
}
