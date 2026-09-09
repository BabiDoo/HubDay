/** Base URL of the Hubday API. Configured via VITE_API_URL, with a local fallback. */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";
