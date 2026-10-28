"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Animated from "../ui/AnimatedSection";
import SectionHeader from "../ui/SectionHeader";
import { Mail, Phone, MapPin, Send, CheckCircle, Copy, Check, AlertCircle } from "lucide-react";
import { isApiError, sendContact } from "../../lib/api";
import type { Settings } from "../../lib/api";

const MAX_MESSAGE = 1000;

type Form = {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Honeypot — real visitors never see or fill this field. */
  website: string;
};
const EMPTY: Form = {
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};
type Status = "idle" | "sending" | "sent" | "error";

/** Zod field errors arrive as `[{ path, message }]` inside the error details. */
const fieldErrorsFrom = (details: unknown): Record<string, string> => {
  if (!Array.isArray(details)) return {};
  const mapped: Record<string, string> = {};
  for (const detail of details) {
    if (typeof detail !== "object" || detail === null) continue;
    const path = "path" in detail && typeof detail.path === "string" ? detail.path : null;
    const message =
      "message" in detail && typeof detail.message === "string" ? detail.message : null;
    if (path && message) mapped[path] = message;
  }
  return mapped;
};

const validate = (form: Form): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (form.name.trim().length < 2 || form.name.trim().length > 80) {
    errors.name = "Enter your name (2–80 characters).";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (form.subject.trim().length > 120) {
    errors.subject = "Keep the subject to 120 characters.";
  }
  const length = form.message.trim().length;
  if (length < 10 || length > MAX_MESSAGE) {
    errors.message = "Write a message between 10 and 1000 characters.";
  }
  return errors;
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0a1024] px-4! py-3! text-sm text-white outline-none transition-all placeholder:text-[#3d5070] focus:border-[#3b82f6]/60 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]";

export default function ContactSection({
  settings,
  availability,
}: {
  settings: Settings;
  availability: { isAvailable: boolean; label: string };
}) {
  const email = settings.contactEmail;
  const phoneDisplay = settings.phone;
  const phoneHref = `tel:${settings.phone.replace(/[^\d+]/g, "")}`;
  const location = settings.location || "Nigeria";
  const [form, setForm] = useState<Form>(EMPTY);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const onChange =
    (key: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const localErrors = validate(form);
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      setStatus("error");
      setError("Please fix the highlighted fields and try again.");
      return;
    }

    setStatus("sending");
    setError(null);
    try {
      await sendContact(form);
      setStatus("sent");
      setForm(EMPTY);
      setFieldErrors({});
      setTimeout(() => setStatus("idle"), 6000);
    } catch (err) {
      setStatus("error");

      if (!isApiError(err)) {
        setError(`The message could not be sent. Please try again, or email ${email} directly.`);
        return;
      }

      if (err.status === 400 || err.code === "VALIDATION_ERROR") {
        setFieldErrors(fieldErrorsFrom(err.details));
        setError(err.message);
      } else if (err.code === "DUPLICATE_MESSAGE" || err.status === 409) {
        setError("This message was already received — no need to send it again.");
      } else if (err.code === "RATE_LIMITED" || err.status === 429) {
        setError("Too many messages from this connection. Please try again later.");
      } else {
        setError(`The message could not be sent (${err.message}). You can also email ${email} directly.`);
      }
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the mailto link still works */
    }
  };

  const busy = status === "sending" || status === "sent";

  return (
    <section id="contact" className="relative overflow-hidden bg-[#0e1528] py-28!">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/3 h-150 w-150 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,.12), transparent 65%)",
          filter: "blur(90px)",
        }}
      />

      <div className="relative px-6! lg:px-16!">
        <SectionHeader
          index="07"
          tag="Let's talk"
          title={
            <>
              Have a project <span className="gradient-text">in mind?</span>
            </>
          }
          description="I'm open to full-time roles, freelance contracts, and interesting collaborations. Whether you're building a startup MVP or scaling an existing system — let's talk."
        />

        <div className="grid items-start gap-10 lg:grid-cols-12">
          {/* ============ LEFT ============ */}
          <div className="lg:col-span-5">
            <Animated direction="left">
              {availability.isAvailable ? (
                <div className="mb-6! inline-flex items-center gap-2 rounded-full border border-[#10b981]/25 bg-[#10b981]/10 px-3.5! py-1.5! font-mono text-xs text-[#10b981]">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#10b981]"
                    style={{ animation: "dotPulse 2s ease-in-out infinite" }}
                  />
                  {availability.label}
                </div>
              ) : null}

              <div className="space-y-3">
                {/* email */}
                {email ? (
                <div className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-4! transition-colors hover:border-[#3b82f6]/40">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[#3b82f6]">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#7c8fa6]">
                      Email
                    </div>
                    <a
                      href={`mailto:${email}`}
                      className="block truncate text-sm text-white transition-colors hover:text-[#3b82f6]"
                    >
                      {email}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={copyEmail}
                    aria-label="Copy email address"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#7c8fa6] transition-colors hover:border-[#3b82f6]/50 hover:text-white"
                  >
                    {copied ? <Check size={15} className="text-[#10b981]" /> : <Copy size={15} />}
                  </button>
                </div>
                ) : null}

                {/* phone */}
                {phoneDisplay ? (
                <a
                  href={phoneHref}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-4! transition-colors hover:border-[#3b82f6]/40"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[#3b82f6]">
                    <Phone size={18} />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#7c8fa6]">
                      Phone
                    </div>
                    <div className="text-sm text-white">{phoneDisplay}</div>
                  </div>
                </a>
                ) : null}

                {/* location */}
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-4!">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[#3b82f6]">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#7c8fa6]">
                      Based in
                    </div>
                    <div className="text-sm text-white">{location}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6! flex flex-wrap gap-2">
                {["Full-time roles", "Freelance contracts", "Collaborations"].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-white/3 px-3.5! py-1.5! font-mono text-xs text-[#9db0c6]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Animated>
          </div>

          {/* ============ RIGHT — compose window ============ */}
          <div className="lg:col-span-7">
            <Animated direction="right" delay={100}>
              <form
                onSubmit={handleSubmit}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1024]/80 backdrop-blur"
              >
                <div className="flex items-center gap-1.5 border-b border-white/5 bg-[#131c35] px-4! py-3!">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#ffbe2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c941]" />
                  <span className="ml-3 font-mono text-xs text-[#7c8fa6]">new-message</span>
                </div>

                <div className="space-y-4 p-6! sm:p-8!">
                  {/* Honeypot: hidden from humans, tempting to bots. */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={form.website}
                    onChange={onChange("website")}
                    className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="c-name" className="font-mono text-xs text-[#7c8fa6]">
                        Name
                      </label>
                      <input
                        id="c-name"
                        type="text"
                        required
                        autoComplete="name"
                        placeholder="Your name"
                        value={form.name}
                        onChange={onChange("name")}
                        className={inputCls}
                      />
                      {fieldErrors.name && (
                        <span className="text-xs text-[#fca5a5]">{fieldErrors.name}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="c-email" className="font-mono text-xs text-[#7c8fa6]">
                        Email
                      </label>
                      <input
                        id="c-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="your@email.com"
                        value={form.email}
                        onChange={onChange("email")}
                        className={inputCls}
                      />
                      {fieldErrors.email && (
                        <span className="text-xs text-[#fca5a5]">{fieldErrors.email}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="c-subject" className="font-mono text-xs text-[#7c8fa6]">
                      Subject
                    </label>
                    <input
                      id="c-subject"
                      type="text"
                      placeholder="Project / Job offer / Collab"
                      value={form.subject}
                      onChange={onChange("subject")}
                      className={inputCls}
                    />
                    {fieldErrors.subject && (
                      <span className="text-xs text-[#fca5a5]">{fieldErrors.subject}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="c-message" className="font-mono text-xs text-[#7c8fa6]">
                        Message
                      </label>
                      <span className="font-mono text-[11px] text-white/30">
                        {form.message.length}/{MAX_MESSAGE}
                      </span>
                    </div>
                    <textarea
                      id="c-message"
                      rows={6}
                      required
                      maxLength={MAX_MESSAGE}
                      placeholder="Tell me about your project..."
                      value={form.message}
                      onChange={onChange("message")}
                      className={`${inputCls} resize-none`}
                    />
                    {fieldErrors.message && (
                      <span className="text-xs text-[#fca5a5]">{fieldErrors.message}</span>
                    )}
                  </div>

                  {status === "error" && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 px-4! py-3! text-sm text-[#fca5a5]"
                    >
                      <AlertCircle size={16} />
                      {error ??
                        "Something went wrong. Please try again, or email me directly."}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className={`font-grotesk inline-flex w-full items-center justify-center gap-2 rounded-xl px-6! py-3.5! font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-80 ${
                      status === "sent"
                        ? "bg-[#10b981]"
                        : "bg-linear-to-r from-[#3b82f6] to-[#6366f1] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/25"
                    }`}
                  >
                    {status === "sent" ? (
                      <>
                        <CheckCircle size={17} /> Message sent!
                      </>
                    ) : status === "sending" ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Send Message
                      </>
                    )}
                  </button>

                  {status === "sent" && (
                    <p className="text-center font-mono text-xs text-[#10b981]">
                      Daniel will reply by email and may invite you to a live chat.
                    </p>
                  )}
                </div>
              </form>
            </Animated>
          </div>
        </div>
      </div>
    </section>
  );
}