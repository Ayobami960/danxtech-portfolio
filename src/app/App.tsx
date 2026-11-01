import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAppDispatch, useAppSelector } from "./hooks";
import { FullScreenLoader } from "./RequireAuth";
import { AppRoutes } from "./router";
import { setNavigate } from "./navigation";
import { subscribeChannel } from "./channel";
import { bootstrapSession } from "../features/auth/thunks";
import { loggedOut } from "../features/auth/authSlice";
import { RealtimeBridge } from "../realtime/RealtimeBridge";

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

  if (status === "unknown") return <FullScreenLoader />;

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
            background: "#131c35",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#e6edf7",
          },
        }}
      />
    </>
  );
};

