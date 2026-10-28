interface EmailMessage {
    to: string;
    subject: string;
    text: string;
    html?: string;
}
export declare const buildOtpEmailHtml: ({ firstName, code, expiryMinutes, purpose, }: {
    firstName: string;
    code: string;
    expiryMinutes: number;
    purpose: "email_verification" | "password_reset";
}) => string;
export declare const verifyMailer: () => Promise<void>;
export declare const sendEmail: ({ to, subject, text, html }: EmailMessage) => Promise<void>;
export {};
