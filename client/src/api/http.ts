import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { useImpersonationStore } from "../store/impersonationStore";

// Vercel 배포: 동일 도메인이므로 /api (상대경로)
// 로컬 개발: vite.config.ts 프록시가 /api → localhost:4000 으로 처리
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const http = axios.create({ baseURL });

http.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  // Inject impersonation header — skip for /auth/ endpoints so that
  // impersonation control APIs always run with the real admin identity.
  const url = String(config.url ?? "");
  if (!url.includes("/auth/")) {
    const { targetUser } = useImpersonationStore.getState();
    if (targetUser) {
      config.headers["X-Impersonate-User-Id"] = targetUser.id;
    }
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };
    const status = error.response?.status as number | undefined;
    const requestUrl = String(originalRequest?.url ?? "");

    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/logout");

    if (status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      const { refreshToken, updateTokens, clearSession } = useAuthStore.getState();
      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }

      try {
        originalRequest._retry = true;

        // ✅ baseURL에 /api가 포함되어 있으므로 /auth/refresh만 붙이면 됨
        const refreshResponse = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${baseURL}/auth/refresh`,
          { refreshToken }
        );

        updateTokens({
          accessToken: refreshResponse.data.accessToken,
          refreshToken: refreshResponse.data.refreshToken
        });

        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.accessToken}`;
        return http(originalRequest);
      } catch (refreshError) {
        clearSession();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default http;