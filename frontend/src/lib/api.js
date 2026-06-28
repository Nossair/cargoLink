import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Auto-refresh the access token once on 401, then replay the original request.
const NO_REFRESH = ["/auth/refresh", "/auth/login", "/auth/register", "/auth/logout"];
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = original.url || "";
    if (status === 401 && !original._retry && !NO_REFRESH.some((u) => url.includes(u))) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh");
        await refreshing;
        refreshing = null;
        return api(original);
      } catch (e) {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(detail) {
  if (detail == null) return "Une erreur est survenue.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
