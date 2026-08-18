import type {
  BillingPeriod,
  Building,
  Claim,
  Contract,
  Notification,
  Property,
  Tenancy,
  User,
} from "../types";

const TOKEN_KEY = "alquiler_access";
const REFRESH_KEY = "alquiler_refresh";

/** Base de la API. Vacío en local (proxy Vite). En prod: https://tu-api.vercel.app */
const API_BASE = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasStoredSession() {
  return Boolean(getAccessToken() || getRefreshToken());
}

type AuthResult = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

/** Una sola renovación a la vez: si varios requests fallan juntos, no spamean /refresh. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(apiUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResult;
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
  retried = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(path), { ...options, headers });
  if (res.status === 204) return undefined as T;

  // Access vencido: renovamos con el refresh y reintentamos una vez.
  if (auth && res.status === 401 && !retried) {
    const ok = await refreshSession();
    if (ok) return request<T>(path, options, auth, true);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Error de red");
  }
  return data as T;
}

export const api = {
  register(body: { email: string; password: string; name: string; phone?: string }) {
    return request<AuthResult>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify(body) },
      false,
    );
  },
  login(body: { email: string; password: string }) {
    return request<AuthResult>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify(body) },
      false,
    );
  },
  /**
   * Restaura la sesión al abrir la app. Si el access ya venció (15m), usa el
   * refresh. Solo limpia tokens si el refresh también falló.
   */
  async restoreSession(): Promise<User | null> {
    if (!hasStoredSession()) return null;
    try {
      return await request<User>("/api/auth/me");
    } catch {
      clearTokens();
      return null;
    }
  },
  me() {
    return request<User>("/api/auth/me");
  },
  updateMe(body: { name?: string; phone?: string }) {
    return request<User>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  buildings() {
    return request<Building[]>("/api/buildings");
  },
  createBuilding(body: { name: string; address: string; city?: string; notes?: string }) {
    return request<Building>("/api/buildings", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateBuilding(
    id: string,
    body: Partial<{ name: string; address: string; city: string; notes: string }>,
  ) {
    return request<Building>(`/api/buildings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  createProperty(
    buildingId: string,
    body: {
      label: string;
      floor?: string;
      notes?: string;
      billSplitMode?: string;
    },
  ) {
    return request<Property>(`/api/buildings/${buildingId}/properties`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  property(id: string) {
    return request<Property>(`/api/properties/${id}`);
  },
  updateProperty(
    id: string,
    body: Partial<{
      label: string;
      floor: string;
      notes: string;
      billSplitMode: string;
    }>,
  ) {
    return request(`/api/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  myTenancies() {
    return request<Tenancy[]>("/api/properties/mine/tenant");
  },
  addTenant(propertyId: string, body: { email: string; sharePercentage?: number }) {
    return request(`/api/properties/${propertyId}/tenants`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  removeTenant(propertyId: string, tenancyId: string) {
    return request(`/api/properties/${propertyId}/tenants/${tenancyId}`, {
      method: "DELETE",
    });
  },
  addEmergencyContact(
    propertyId: string,
    body: { category: string; name: string; phone: string; notes?: string },
  ) {
    return request(`/api/properties/${propertyId}/emergency-contacts`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  deleteEmergencyContact(propertyId: string, contactId: string) {
    return request(`/api/properties/${propertyId}/emergency-contacts/${contactId}`, {
      method: "DELETE",
    });
  },
  createContract(propertyId: string, form: FormData) {
    return request<Contract>(`/api/contracts/${propertyId}`, {
      method: "POST",
      body: form,
    });
  },
  getPeriod(id: string) {
    return request<BillingPeriod>(`/api/billing/periods/${id}`);
  },
  addInvoice(periodId: string, form: FormData) {
    return request(`/api/billing/periods/${periodId}/invoices`, {
      method: "POST",
      body: form,
    });
  },
  submitPayment(periodId: string, form: FormData) {
    return request(`/api/payments/periods/${periodId}`, {
      method: "POST",
      body: form,
    });
  },
  reviewPayment(id: string, body: { status: "approved" | "rejected"; reviewNote?: string }) {
    return request(`/api/payments/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  createClaim(form: FormData) {
    return request<Claim>("/api/claims", { method: "POST", body: form });
  },
  listClaims(propertyId: string) {
    return request<Claim[]>(`/api/claims/property/${propertyId}`);
  },
  updateClaim(
    id: string,
    body: { status?: string; response?: string; assignedTo?: string },
  ) {
    return request(`/api/claims/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  notifications() {
    return request<Notification[]>("/api/notifications");
  },
  markNotificationRead(id: string) {
    return request(`/api/notifications/${id}/read`, { method: "POST" });
  },
  markAllNotificationsRead() {
    return request("/api/notifications/read-all", { method: "POST" });
  },
  registerDeviceToken(token: string, platform: "ios" | "android" | "web") {
    return request("/api/notifications/device-token", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    });
  },
  fileUrl(path: string) {
    // Siempre por la API: el store de Blob es privado y el browser no puede
    // abrir la URL cruda. El token va por query porque <a href> no manda
    // Authorization.
    const params = new URLSearchParams({ u: path });
    const token = getAccessToken();
    if (token) params.set("access_token", token);
    return apiUrl(`/api/files?${params.toString()}`);
  },
};
