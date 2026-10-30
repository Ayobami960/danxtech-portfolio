
const LOCAL_API = "http://localhost:8000";

const serverUrl =
  typeof window === "undefined" ? process.env.API_URL : undefined;

const configured = serverUrl ?? process.env.NEXT_PUBLIC_API_URL;

if (!configured && process.env.NODE_ENV === "production") {
  throw new Error(
    "The API base URL is not configured. Set  in the hosting environment, then redeploy.",
  );
}

export const API_BASE_URL = (configured ?? LOCAL_API).replace(/\/+$/, "");
