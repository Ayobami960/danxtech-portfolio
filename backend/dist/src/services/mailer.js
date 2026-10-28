import nodemailer, {} from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { escapeHtml } from "../lib/html.js";
let transporter;
export const isMailConfigured = () => Boolean(env.smtp && env.ownerEmail);
const getTransporter = () => {
    if (!env.smtp)
        return undefined;
    transporter ??= nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
    return transporter;
};
/** Verify SMTP at boot without making the API unavailable if it is down. */
export const initializeMailer = async () => {
    const transport = getTransporter();
    if (!transport) {
        logger.info("SMTP is not configured; email notifications are disabled.");
        return;
    }
    try {
        await transport.verify();
        logger.info("SMTP connection verified.");
    }
    catch (error) {
        logger.warn({ err: error }, "SMTP verification failed; will retry on send.");
    }
};
const wait = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
/**
 * Send with up to three attempts and exponential backoff. Throws only after the
 * final attempt so callers can log a genuine failure.
 */
export const sendMail = async (options) => {
    const transport = getTransporter();
    if (!transport || !env.smtp) {
        logger.debug("Email skipped: SMTP is not configured.");
        return false;
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await transport.sendMail({ from: env.smtp.from, ...options });
            return true;
        }
        catch (error) {
            if (attempt === 3)
                throw error;
            logger.warn({ err: error, attempt }, "Email send failed; retrying with backoff");
            await wait(attempt * 500);
        }
    }
    return false;
};
const buildNotification = (message) => {
    const name = escapeHtml(message.name);
    const email = escapeHtml(message.email);
    const subject = escapeHtml(message.subject ?? "(no subject)");
    const body = escapeHtml(message.message).replace(/\n/g, "<br />");
    return {
        subject: `Portfolio contact: ${message.subject ?? "New message"}`,
        text: [
            `New message from ${message.name} <${message.email}>`,
            message.subject ? `Subject: ${message.subject}` : null,
            "",
            message.message,
        ]
            .filter((line) => line !== null)
            .join("\n"),
        html: `
      <div style="font-family:system-ui,sans-serif;line-height:1.6">
        <h2 style="margin:0 0 12px">New portfolio message</h2>
        <p style="margin:0 0 4px"><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <p style="margin:0 0 16px"><strong>Subject:</strong> ${subject}</p>
        <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #3b82f6;background:#f8fafc">
          ${body}
        </blockquote>
      </div>
    `.trim(),
    };
};
/**
 * Send the owner notification. Throws on failure so the caller can log it; the
 * public contact request never fails because of email. `conversationLink`
 * deep-links straight into the admin chat space.
 */
export const sendOwnerNotification = async (message, conversationLink) => {
    if (!env.ownerEmail)
        return;
    const notification = buildNotification(message);
    await sendMail({
        to: env.ownerEmail,
        replyTo: message.email,
        subject: notification.subject,
        text: conversationLink
            ? `${notification.text}\n\nOpen in the admin chat: ${conversationLink}`
            : notification.text,
        html: conversationLink
            ? `${notification.html}\n<p style="margin:16px 0 0"><a href="${escapeHtml(conversationLink)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#3b82f6;color:#fff;text-decoration:none;font-weight:600">Open in Admin</a></p>`
            : notification.html,
    });
};
/**
 * Acknowledge the visitor's contact submission. Never sent when the form was
 * honeypot-discarded (the caller only reaches here for real submissions).
 */
export const sendVisitorConfirmation = async (message) => {
    const firstName = message.name.trim().split(/\s+/)[0] ?? "there";
    await sendMail({
        to: message.email,
        replyTo: env.ownerEmail,
        subject: "Message received — thanks for reaching out",
        text: [
            `Hi ${firstName},`,
            "",
            "Thanks for your message. It was received and is waiting in my inbox.",
            "I'll read it and reply by email within one working day.",
            "",
            "If it's easier to talk live, I may send you a private chat link — no account needed.",
            "",
            "— Adetoye Daniel Kehinde",
        ].join("\n"),
        html: emailShell("Message received", [
            `Hi ${escapeHtml(firstName)},`,
            "Thanks for your message. It was received and is waiting in my inbox.",
            "I'll read it and reply by email within one working day.",
            "If it's easier to talk live, I may send you a private chat link — no account needed.",
        ], undefined, "You received this email because you used the contact form on Adetoye Daniel Kehinde's portfolio."),
    });
};
/** Account security notice to the owner (password, 2FA, lockout). */
export const sendSecurityNotice = async (subject, lines) => {
    if (!env.ownerEmail)
        return;
    try {
        await sendMail({
            to: env.ownerEmail,
            subject,
            text: `${subject}\n\n${lines.join("\n")}\n\n— Portfolio admin`,
            html: `
        <div style="font-family:system-ui,sans-serif;line-height:1.6">
          <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
          ${lines.map((line) => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`).join("")}
        </div>
      `.trim(),
        });
    }
    catch (error) {
        logger.error({ err: error }, "Security notice email failed");
    }
};
/** Shared shell for conversational emails. */
export const emailShell = (heading, paragraphs, cta, footer) => `
  <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.65;color:#0f172a;max-width:560px">
    <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h2>
    ${paragraphs.map((line) => `<p style="margin:0 0 12px">${line}</p>`).join("")}
    ${cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>
           <p style="margin:0 0 12px;font-size:13px;color:#64748b">Or copy this link: ${escapeHtml(cta.url)}</p>`
    : ""}
    ${footer ? `<p style="margin:24px 0 0;font-size:13px;color:#64748b">${escapeHtml(footer)}</p>` : ""}
  </div>
`;
//# sourceMappingURL=mailer.js.map