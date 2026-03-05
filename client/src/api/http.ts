import axios from "axios";
import { useAuthStore } from "../store/authStore";

// ✅ /api 까지 포함해서 통일
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "https://ems-9j17.onrender.com/api";

const http = axios.create({ baseURL });

http.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
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