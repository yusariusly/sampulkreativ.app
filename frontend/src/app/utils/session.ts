export const KEYS = {
  USER: "v2_user",
  DEVICE_ID: "v2_device_id",
  CLOCK_IN_TIME: "v2_clockInTime",
  TOKEN: "v2_scanned_token",
};

export const getDeviceId = (): string => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEYS.DEVICE_ID) || "";
};

export const getStoredUser = (): any | null => {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem(KEYS.USER);
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch (e) {
    return null;
  }
};

export const clearSession = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.USER);
  localStorage.removeItem(KEYS.CLOCK_IN_TIME);
  localStorage.removeItem(KEYS.TOKEN);
};
