import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { getTemplate } from "./templates";
import type { Locale } from "@/lib/constants";

export type NotificationEvent =
  | "payment_reminder_before"
  | "payment_reminder_due"
  | "payment_reminder_after"
  | "somatie_generated"
  | "decizie_ready"
  | "certificat_ready"
  | "account_verification"
  | "payment_confirmation";

interface SendNotificationParams {
  tenantId: string;
  contribuabilId?: string;
  citizenUserId?: string;
  recipientEmail: string;
  event: NotificationEvent;
  limba: Locale;
  data: Record<string, unknown>;
  triggerEntityType?: string;
  triggerEntityId?: string;
}

/**
 * Send a notification to a contribuabil or citizen.
 * Checks consent before sending and logs everything.
 */
export async function sendNotification(params: SendNotificationParams): Promise<string> {
  const {
    tenantId,
    contribuabilId,
    citizenUserId,
    recipientEmail,
    event,
    limba,
    data,
    triggerEntityType,
    triggerEntityId,
  } = params;

  // Check consent if contribuabil is specified
  if (contribuabilId) {
    const consent = await prisma.consimtamant.findUnique({
      where: {
        tenantId_contribuabilId_canal: {
          tenantId,
          contribuabilId,
          canal: "email",
        },
      },
    });

    if (!consent?.consimtamant) {
      // Log as skipped due to no consent
      const notif = await prisma.notificare.create({
        data: {
          tenantId,
          contribuabilId,
          citizenUserId,
          recipientEmail,
          canal: "email",
          template: event,
          limba,
          subject: "",
          dataJson: data as Record<string, string>,
          status: "failed",
          errorMessage: "No email consent",
          triggerEvent: event,
          triggerEntityType,
          triggerEntityId,
        },
      });
      return notif.id;
    }
  }

  // Get template content
  const template = getTemplate(event, limba);
  const subject = interpolate(template.subject, data);
  const bodyHtml = interpolate(template.bodyHtml, data);
  const bodyText = interpolate(template.bodyText, data);

  // Create notification record
  const notif = await prisma.notificare.create({
    data: {
      tenantId,
      contribuabilId,
      citizenUserId,
      recipientEmail,
      canal: "email",
      template: event,
      limba,
      subject,
      bodyHtml,
      bodyText,
      dataJson: data as Record<string, string>,
      status: "pending",
      triggerEvent: event,
      triggerEntityType,
      triggerEntityId,
    },
  });

  // Send email
  try {
    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html: bodyHtml,
      text: bodyText,
    });

    await prisma.notificare.update({
      where: { id: notif.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        externalId: result.messageId,
      },
    });
  } catch (error) {
    await prisma.notificare.update({
      where: { id: notif.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }

  return notif.id;
}

/**
 * Send batch notifications (e.g., payment reminders).
 */
export async function sendBatchNotifications(
  tenantId: string,
  event: NotificationEvent,
  recipients: Array<{
    contribuabilId: string;
    citizenUserId?: string;
    email: string;
    limba: Locale;
    data: Record<string, unknown>;
  }>
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    try {
      const id = await sendNotification({
        tenantId,
        contribuabilId: recipient.contribuabilId,
        citizenUserId: recipient.citizenUserId,
        recipientEmail: recipient.email,
        event,
        limba: recipient.limba,
        data: recipient.data,
      });

      const notif = await prisma.notificare.findUnique({
        where: { id },
        select: { status: true },
      });

      if (notif?.status === "sent") sent++;
      else if (notif?.status === "failed" && notif) {
        // Check if it was a consent issue
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { sent, failed, skipped };
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}
