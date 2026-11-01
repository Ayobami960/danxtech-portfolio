import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { FullScreenLoader } from "./RequireAuth";
import { AppRoutes } from "./routes/router";
import { setNavigate } from "./utils/navigation";
import { subscribeChannel } from "./utils/channel";
import { bootstrapSession } from "./features/auth/thunks";
import { loggedOut } from "./features/auth/authSlice";
import { RealtimeBridge } from "./realtime/RealtimeBridge";
import { ErrorState } from "./components/States";

const NavigationBridge = () => {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate((path, options) => navigate(path, options));
  }, [navigate]);
  return null;
};

const SessionChannel = () => {
  const dispatch = useAppDispatch();
  useEffect(
    () =>
      subscribeChannel({
        onLogout: () => {
          // The store listener sees consumeRemoteLogout() and will not rebroadcast.
          dispatch(loggedOut());
        },
        onActivity: () => undefined,
      }),
    [dispatch],
  );
  return null;
};

export const App = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);

  useEffect(() => {
    void dispatch(bootstrapSession());
  }, [dispatch]);

  // While the session probe is failing, retry automatically when the browser
  // reports the connection is back.
  useEffect(() => {
    if (status !== "unavailable") return;
    const retry = (): void => {
      void dispatch(bootstrapSession());
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [status, dispatch]);

  if (status === "unknown") return <FullScreenLoader />;

  if (status === "unavailable") {
    return (
      <main className="glow-blue flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <ErrorState
            error={{ status: 503, code: "SERVICE_UNAVAILABLE", message: "" }}
            onRetry={() => void dispatch(bootstrapSession())}
          />
          <p className="mt-4 text-center text-xs text-[#7c8fa6]">
            You are still signed in. Retrying never clears your session.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <NavigationBridge />
      <SessionChannel />
      <RealtimeBridge />
      <AppRoutes />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0b1713",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#edf2ef",
          },
        }}
      />
    </>
  );
};

