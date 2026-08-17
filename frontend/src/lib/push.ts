import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "./api";

export async function setupPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", (token) => {
    const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
    void api.registerDeviceToken(token.value, platform);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("Push registration error", err);
  });
}
