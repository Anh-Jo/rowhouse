import createClient from "openapi-fetch";
import type { paths } from "@/api/generated/schema.d.ts";

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const fetchClient = createClient<paths>({
  baseUrl: API_BASE,
  credentials: "include",
});
