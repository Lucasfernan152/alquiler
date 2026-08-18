import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alquiler.app",
  appName: "Rently",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
    },
    // Barras de estado y de navegación con fondo de marca: iconos claros.
    SystemBars: {
      style: "DARK",
    },
  },
};

export default config;
