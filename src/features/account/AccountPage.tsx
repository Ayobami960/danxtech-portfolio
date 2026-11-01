import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  Monitor,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  useDisableTwoFactorMutation,
  useEnableTwoFactorMutation,
  useGetSessionsQuery,
  useGetTwoFactorQuery,
  useRegenerateRecoveryCodesMutation,
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
  useSetupTwoFactorMutation,
} from "../../api/adminApi";
import type { TwoFactorStatus } from "../../api/types";
import { errorMessage } from "../../api/errors";
import { useAppDispatch } from "../../app/hooks";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState, LoadingList } from "../../components/States";
import { changePassword } from "../auth/thunks";
import { formatDate } from "../../lib/format";
import { passwordSchema } from "../../lib/schemas";
import type { z } from "zod";

type PasswordForm = z.infer<typeof passwordSchema>;

export default function AccountPage() {
  const twoFactor = useGetTwoFactorQuery();

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Account"
        description="Two-factor authentication, active sessions and your password. Sensitive changes require your current password."
      />

      {twoFactor.isLoading ? (
        <LoadingList rows={3} />
      ) : twoFactor.error ? (
        <ErrorState error={twoFactor.error} onRetry={twoFactor.refetch} />
      ) : twoFactor.data ? (
        <div className="space-y-5">
          <TwoFactorSection status={twoFactor.data} />
          <SessionsSection />
          <PasswordSection />
        </div>
      ) : null}
    </>
  );
}

const CopyButton = ({ value, label = "Copy" }: { value: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          toast.success("Copied");
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />} {label}
    </button>
  );
};

const TwoFactorSection = ({ status }: { status: TwoFactorStatus }) => {
  const [setup] = useSetupTwoFactorMutation();
  const [enable, enableState] = useEnableTwoFactorMutation();
  const [disable, disableState] = useDisableTwoFactorMutation();
  const [regenerate, regenerateState] = useRegenerateRecoveryCodesMutation();

  // Secrets and recovery codes live only in this component's state and never
  // enter Redux or storage. They are cleared when the flow closes.
  const [setupData, setSetupData] = useState<{ otpauthUrl: string; secret: string } | null>(
    null,
  );
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disableOpen, setDisableOpen] = useState(false);

  const beginSetup = async (): Promise<void> => {
    try {
      const result = await setup().unwrap();
      setSetupData(result);
      setCode("");
      setCodes([]);
    } catch (error) {
      toast.error(errorMessage(error, "Could not start 2FA setup."));
    }
  };

  const confirmEnable = async (): Promise<void> => {
    try {
      const result = await enable({ code }).unwrap();
      setCodes(result.recoveryCodes);
      setSetupData(null);
      setCode("");
      toast.success("Two-factor authentication enabled");
    } catch (error) {
      toast.error(errorMessage(error, "That code was not accepted."));
    }
  };

  const confirmDisable = async (): Promise<void> => {
    try {
      await disable({ password, code }).unwrap();
      setDisableOpen(false);
      setPassword("");
      setCode("");
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      toast.error(errorMessage(error, "Could not disable 2FA."));
    }
  };

  const regenerateCodes = async (): Promise<void> => {
    try {
      const result = await regenerate({ password }).unwrap();
      setCodes(result.recoveryCodes);
      setPassword("");
      toast.success("New recovery codes generated — old codes no longer work");
    } catch (error) {
      toast.error(errorMessage(error, "Could not regenerate recovery codes."));
    }
  };

  const downloadCodes = (): void => {
    const blob = new Blob([codes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "admin-recovery-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      title="two_factor"
      actions={
        <span
          className={
            status.enabled
              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-300"
              : "inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-[#7c8fa6]"
          }
        >
          {status.enabled ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
          {status.enabled ? "Enabled" : "Disabled"}
        </span>
      }
    >
      {codes.length > 0 ? (
        <div className="rounded-xl border border-[#f0a500]/40 bg-[#f0a500]/5 p-4">
          <h3 className="font-grotesk font-semibold text-[#f0a500]">
            Save these recovery codes now
          </h3>
          <p className="mt-1 text-xs text-[#cbd8e8]">
            Each code works once. They will not be shown again.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm text-white">
            {codes.map((value) => (
              <span key={value} className="rounded border border-white/10 px-2 py-1">
                {value}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton value={codes.join("\n")} label="Copy codes" />
            <button type="button" className="btn btn-ghost" onClick={downloadCodes}>
              <Download size={14} /> Download
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCodes([])}
            >
              I saved them
            </button>
          </div>
        </div>
      ) : setupData ? (
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={setupData.otpauthUrl} size={168} />
          </div>
          <div>
            <p className="text-sm text-[#cbd8e8]">
              Scan the QR code with your authenticator app, or enter this key manually:
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded border border-white/10 bg-[#0a0f1e] px-2 py-1 font-mono text-xs text-white">
                {setupData.secret}
              </code>
              <CopyButton value={setupData.secret} label="Copy key" />
            </div>
            <label className="label mt-4" htmlFor="enable-code">
              6-digit code
            </label>
            <input
              id="enable-code"
              className="field font-mono tracking-widest"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={code.length !== 6 || enableState.isLoading}
                onClick={() => void confirmEnable()}
              >
                {enableState.isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ShieldCheck size={14} />
                )}
                Verify & enable
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setSetupData(null);
                  setCode("");
                }}
              >
                Cancel
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[#5f7189]">
              The secret is stored encrypted and never returned by the API again.
            </p>
          </div>
        </div>
      ) : status.enabled ? (
        <div className="space-y-4">
          <p className="text-sm text-[#cbd8e8]">
            Two-factor is on.{" "}
            <span className="text-[#9db0c6]">
              {status.recoveryCodesRemaining} recovery code(s) remaining.
            </span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 p-3">
              <span className="label">Regenerate recovery codes</span>
              <input
                className="field mt-1"
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost mt-2 w-full"
                disabled={!password || regenerateState.isLoading}
                onClick={() => void regenerateCodes()}
              >
                <KeyRound size={14} /> Generate new codes
              </button>
            </div>
            <div className="rounded-xl border border-white/10 p-3">
              <span className="label">Disable two-factor</span>
              <p className="mt-1 text-[11px] text-[#7c8fa6]">
                Requires your password and a current code.
              </p>
              <button
                type="button"
                className="btn btn-danger mt-2 w-full"
                onClick={() => setDisableOpen(true)}
              >
                <ShieldOff size={14} /> Disable 2FA
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <p className="max-w-xl text-sm text-[#9db0c6]">
            Add a second factor with any TOTP authenticator app. You will receive 10
            single-use recovery codes.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void beginSetup()}>
            <ShieldCheck size={15} /> Set up 2FA
          </button>
        </div>
      )}

      <ConfirmDialog
        open={disableOpen}
        title="Disable two-factor authentication?"
        description="Your account becomes protected by the password alone. Confirm with your password and a current 6-digit code."
        confirmLabel="Disable 2FA"
        busy={disableState.isLoading}
        onClose={() => setDisableOpen(false)}
        onConfirm={() => {
          if (!password || code.length !== 6) {
            toast.error("Enter your password and a current 6-digit code.");
            return;
          }
          void confirmDisable();
        }}
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          className="field"
          type="password"
          placeholder="Current password"
          aria-label="Current password for 2FA actions"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <input
          className="field font-mono tracking-widest"
          placeholder="6-digit code"
          aria-label="Two-factor code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        />
      </div>
    </Card>
  );
};

const SessionsSection = () => {
  const query = useGetSessionsQuery();
  const [revoke] = useRevokeSessionMutation();
  const [revokeOthers, revokeOthersState] = useRevokeOtherSessionsMutation();
  const [confirmOthers, setConfirmOthers] = useState(false);

  return (
    <Card
      title="active_sessions"
      actions={
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setConfirmOthers(true)}
        >
          Sign out everywhere else
        </button>
      }
      bodyClassName="p-0"
    >
      {query.isLoading ? (
        <div className="p-4">
          <LoadingList rows={2} />
        </div>
      ) : query.error ? (
        <div className="p-4">
          <ErrorState error={query.error} onRetry={query.refetch} />
        </div>
      ) : query.data && query.data.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 font-mono text-[10px] uppercase tracking-wide text-[#5f7189]">
                <th className="px-4 py-3">Device</th>
                <th className="hidden px-4 py-3 sm:table-cell">Signed in</th>
                <th className="hidden px-4 py-3 sm:table-cell">Last used</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {query.data.data.map((session) => (
                <tr key={session.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Monitor size={15} className="text-[#7c8fa6]" />
                      <span className="text-[#dbe6f5]">{session.device}</span>
                      {session.current ? (
                        <span className="rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#93c5fd]">
                          this device
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-[11px] text-[#7c8fa6] sm:table-cell">
                    {formatDate(session.createdAt)}
                  </td>
                  <td className="hidden px-4 py-3 text-[11px] text-[#7c8fa6] sm:table-cell">
                    {session.lastUsedAt ? formatDate(session.lastUsedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {session.current ? (
                      <span className="font-mono text-[10px] text-[#5f7189]">current</span>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-red-500/10 hover:text-red-300"
                        aria-label={`Revoke ${session.device}`}
                        onClick={() => {
                          void revoke(session.id)
                            .unwrap()
                            .then(() => toast.success("Session revoked"))
                            .catch((error: unknown) => toast.error(errorMessage(error)));
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-center text-sm text-[#7c8fa6]">No active sessions.</p>
      )}

      <ConfirmDialog
        open={confirmOthers}
        title="Sign out everywhere else?"
        description="Every other session is revoked immediately. This device stays signed in."
        confirmLabel="Sign out other sessions"
        busy={revokeOthersState.isLoading}
        onClose={() => setConfirmOthers(false)}
        onConfirm={() => {
          void revokeOthers()
            .unwrap()
            .then((result) => {
              toast.success(`${result.revoked} session(s) revoked`);
              setConfirmOthers(false);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </Card>
  );
};

const PasswordSection = () => {
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = form.watch("newPassword");
  const strength = Math.min(
    4,
    (/[a-z]/.test(newPassword) ? 1 : 0) +
      (/[A-Z]/.test(newPassword) ? 1 : 0) +
      (/\d/.test(newPassword) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0) +
      (newPassword.length >= 16 ? 1 : 0),
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await dispatch(
        changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      ).unwrap();
      toast.success("Password changed — all sessions were revoked");
    } catch (error) {
      toast.error(errorMessage(error, "Could not change the password."));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Card title="change_password" className="max-w-2xl">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label className="label" htmlFor="current-password">
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            className="field"
            autoComplete="current-password"
            {...form.register("currentPassword")}
          />
          {form.formState.errors.currentPassword ? (
            <p className="mt-1 text-xs text-red-300">
              {form.formState.errors.currentPassword.message}
            </p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="new-password">
            New password · at least 12 characters
          </label>
          <input
            id="new-password"
            type="password"
            className="field"
            autoComplete="new-password"
            {...form.register("newPassword")}
          />
          <div className="mt-2 flex gap-1" aria-hidden>
            {Array.from({ length: 4 }, (_, index) => (
              <span
                key={index}
                className={
                  index < strength
                    ? "h-1 flex-1 rounded-full bg-emerald-400"
                    : "h-1 flex-1 rounded-full bg-white/10"
                }
              />
            ))}
          </div>
          {form.formState.errors.newPassword ? (
            <p className="mt-1 text-xs text-red-300">
              {form.formState.errors.newPassword.message}
            </p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            className="field"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="mt-1 text-xs text-red-300">
              {form.formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
          Change password
        </button>
        <p className="text-[11px] text-[#5f7189]">
          Changing your password signs out every session, including this one.
        </p>
      </form>
    </Card>
  );
};
