import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "./api";

/**
 * En Android, registrarse contra FCM sin `google-services.json` tira una
 * excepción nativa que Capacitor reenvía como RuntimeException y mata la app.
 * Por eso el push arranca apagado y hay que habilitarlo recién cuando el
 * proyecto de Firebase esté configurado (ver DEPLOY.md).
 */
const pushEnabled = import.meta.env.VITE_PUSH_ENABLED === "true";

export async function setupPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  if (!pushEnabled) return;

  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return;

    PushNotifications.addListener("registration", (token) => {
      const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
      void api.registerDeviceToken(token.value, platform);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("Push registration error", err);
    });

    await PushNotifications.register();
  } catch (err) {
    console.warn("Push no disponible", err);
  }
}
