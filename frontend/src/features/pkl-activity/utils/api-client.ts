/**
 * @file utils/api-client.ts
 * @description Lightweight API Client wrapper on top of native fetch.
 * Automatically injects authentication headers and intercepts errors for global notification.
 */

import { getDeviceId, getStoredUser } from "@/app/utils/session";

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers: customHeaders, ...restOptions } = options;

  // Build URL with query params
  let url = path;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Get session info
  const userObj = getStoredUser();
  const userId = userObj?.id || "";
  const deviceId = getDeviceId();

  // Build headers
  const headers = new Headers();
  if (userId) {
    headers.set("x-user-id", userId);
  }
  if (deviceId) {
    headers.set("x-device-id", deviceId);
  }
  if (!(restOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Merge custom headers
  if (customHeaders) {
    new Headers(customHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  let errorData: any = null;
  let responseData: any = null;

  try {
    const text = await response.text();
    responseData = text ? JSON.parse(text) : null;
  } catch (e) {
    // Response is not JSON
  }

  if (!response.ok) {
    errorData = responseData || {
      status: "error",
      error: {
        code: "SERVER_ERROR",
        message: "Terjadi kesalahan pada server"
      }
    };

    // Global Error Interceptor: Dispatch Event for global layout listening
    if (typeof window !== "undefined") {
      const errorMessage = errorData.error?.message || "Terjadi kesalahan koneksi";
      window.dispatchEvent(
        new CustomEvent("api-error", {
          detail: {
            message: errorMessage,
            code: errorData.error?.code
          }
        })
      );
    }

    throw errorData;
  }

  return responseData;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: any, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: any, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: any, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
