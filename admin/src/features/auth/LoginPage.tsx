import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { isApiError } from "../../api/errors";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { login, verifyTwoFactor } from "./thunks";

const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

type LoginForm = z.infer<typeof loginSchema>;

const codeSchema = z.object({
  code: z.string().trim().min(6, "Enter the 6-digit code or a recovery code."),
});

type CodeForm = z.infer<typeof codeSchema>;

const safeNext = (value: string | null): string =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = useAppSelector((state) => state.auth.status);
  const [step, setStep] = useState<"password" | "code">("password");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const next = safeNext(params.get("next"));

  const passwordForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (status === "authenticated") navigate(next, { replace: true });
  }, [status, navigate, next]);

  if (status === "authenticated") return <Navigate to={next} replace />;

  const onPassword = passwordForm.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await dispatch(login(values)).unwrap();
      if (result.requires2fa) {
        setShowPassword(false);
        setStep("code");
      } else {
        navigate(next, { replace: true });
      }
    } catch (thrown) {
      if (isApiError(thrown)) {
        setError(
          thrown.status === 429
            ? "Too many attempts, try again later."
            : "Invalid email or password.",
        );
      } else {
        setError("Unable to sign in right now.");
      }
    }
  });

  const onCode = codeForm.handleSubmit(async (values) => {
    setError(null);
    try {
      await dispatch(verifyTwoFactor(values)).unwrap();
      navigate(next, { replace: true });
    } catch (thrown) {
      setError(
        isApiError(thrown) && thrown.status === 429
          ? "Too many attempts, try again later."
          : "Invalid code.",
      );
    }
  });

  return (
    <main className="glow-blue flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 font-grotesk text-lg font-bold text-[#3b82f6]">
            AD
          </div>
          <h1 className="font-grotesk text-2xl font-bold text-white">Admin access</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#7c8fa6]">
            Adetoye Daniel Kehinde
          </p>
        </div>

        <div className="window-card p-6 sm:p-8">
          {step === "password" ? (
            <form onSubmit={onPassword} className="space-y-4" noValidate>
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  className="field"
                  {...passwordForm.register("email")}
                />
                {passwordForm.formState.errors.email ? (
                  <p className="mt-1 text-xs text-red-300">
                    {passwordForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="field !pr-16"
                    {...passwordForm.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-3 flex items-center font-mono text-[11px] uppercase tracking-[0.15em] text-[#7c8fa6] transition hover:text-white"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {passwordForm.formState.errors.password ? (
                  <p className="mt-1 text-xs text-red-300">
                    {passwordForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              {error ? (
                <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={passwordForm.formState.isSubmitting}
              >
                {passwordForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={onCode} className="space-y-4" noValidate>
              <div>
                <p className="text-sm text-[#9db0c6]">
                  Enter the 6-digit code from your authenticator app, or a recovery code.
                </p>
                <label className="label mt-4" htmlFor="code">
                  Verification code
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  className="field font-mono tracking-[0.2em]"
                  {...codeForm.register("code")}
                />
                {codeForm.formState.errors.code ? (
                  <p className="mt-1 text-xs text-red-300">
                    {codeForm.formState.errors.code.message}
                  </p>
                ) : null}
              </div>

              {error ? (
                <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={codeForm.formState.isSubmitting}
              >
                {codeForm.formState.isSubmitting ? "Verifying…" : "Verify and continue"}
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setStep("password");
                  setError(null);
                  setShowPassword(false);
                }}
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-[#5f7189]">
          Private area · one owner account · just for me.
        </p>
      </div>
    </main>
  );
}