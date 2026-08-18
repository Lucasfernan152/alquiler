# Deploy en la nube (Vercel + Neon)

Guía paso a paso después de los cambios de código ya hechos en el repo.

## Qué quedó listo en el código

- Prisma usa **Postgres** (Neon).
- API lista para **Vercel Serverless** (`backend/api/index.ts` + `backend/vercel.json`).
- Archivos van a **Vercel Blob** si hay `BLOB_READ_WRITE_TOKEN` (si no, disco local en dev).
- Front lee `VITE_API_URL` para apuntar a la API en prod.
- Cron diario (plan Hobby): emails de avisos no leídos + apertura de períodos.

---

## Paso 1 — Neon (base de datos gratis)

1. Entrá a [https://console.neon.tech](https://console.neon.tech) y creá una cuenta.
2. Create project → nombre `alquiler`.
3. Copiá el **connection string** (formato `postgresql://...?...sslmode=require`).
4. En tu máquina, editá `backend/.env`:

```bash
DATABASE_URL="REEMPLAZAR_CON_EL_CONNECTION_STRING_DE_NEON"
```

5. Aplicá el schema:

```bash
cd backend
npm install
npx prisma db push
npx prisma generate
```

Con eso la DB queda vacía y lista. El SQLite viejo (`dev.db`) ya no se usa.

---

## Paso 2 — Subí el repo a GitHub

Si todavía no está en GitHub:

```bash
cd /Users/lucas.fernandez/Documents/lucas/github/alquiler
git status
# commit + push a tu remoto
```

Vercel deploya desde el repo.

---

## Paso 3 — Proyecto API en Vercel

1. Entrá a [https://vercel.com](https://vercel.com) → Add New Project → importá el repo.
2. Configuración:
   - **Root Directory:** `backend`
   - Framework: Other
   - Build Command: `npm run build` (ya está en `vercel.json`)
3. Variables de entorno (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | connection string de Neon |
| `JWT_ACCESS_SECRET` | string largo random |
| `JWT_REFRESH_SECRET` | otro string random |
| `CRON_SECRET` | string random (ej. `openssl rand -hex 32`) |
| `BLOB_READ_WRITE_TOKEN` | lo creás en el paso 4 |
| `CORS_ORIGIN` | URL del front (la vas a tener en el paso 5; podés poner `*` al principio y ajustar) |
| `APP_URL` | misma URL del front |
| `SMTP_*` | opcional (mails de respaldo) |

4. Deploy. Anotá la URL, ej. `https://alquiler-api.vercel.app`.
5. Probá: `https://alquiler-api.vercel.app/api/health` → `{ "ok": true, ... }`.

---

## Paso 4 — Vercel Blob (archivos)

1. En el **mismo proyecto API** (o en el team): Storage → Create → **Blob**.
2. Elegí acceso **Private** (recomendado: contratos, facturas y comprobantes).
3. Conectalo al proyecto API.
4. Copiá el token `BLOB_READ_WRITE_TOKEN` y agregalo a las env del proyecto API.
5. Redeploy del API.

Sin este token los uploads fallan en Vercel (no hay disco persistente).
El backend sube con `access: "private"` y sirve los archivos por `/api/files`
autenticado (un store Public no hace falta).

---

## Paso 5 — Proyecto Frontend en Vercel

1. Add New Project → **mismo repo**.
2. Configuración:
   - **Root Directory:** `frontend`
   - Framework Preset: Vite
   - Build: `npm run build`
   - Output: `dist`
3. Env:

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://alquiler-api.vercel.app` (sin `/` final) |

4. Deploy. Anotá la URL, ej. `https://alquiler-web.vercel.app`.
5. Volvé al proyecto API y actualizá:
   - `CORS_ORIGIN=https://alquiler-web.vercel.app`
   - `APP_URL=https://alquiler-web.vercel.app`
6. Redeploy del API.

Abrí el front, iniciá con Google y probá crear un edificio.

---

## Paso 6 — Cron (ya configurado)

En `backend/vercel.json` hay un cron diario `0 6 * * *` → `/api/jobs/daily` (Hobby solo permite 1 vez por día).

Vercel manda `Authorization: Bearer <CRON_SECRET>` automáticamente si esa env existe.

Si más adelante querés emails **cada hora**, usá [cron-job.org](https://cron-job.org) gratis pegándole a:

`GET https://alquiler-api.vercel.app/api/jobs/email-unread`  
Header: `Authorization: Bearer <CRON_SECRET>`

---

## Paso 7 — App Android apuntando a prod

```bash
cd frontend
echo 'VITE_API_URL=https://alquiler-api.vercel.app' > .env.production
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### Push nativo (opcional, apagado por defecto)

Sin `frontend/android/app/google-services.json` el registro contra FCM lanza una
excepción nativa que cierra la app, así que el push arranca deshabilitado. Los
avisos igual se ven dentro de la app.

Para prenderlo:

1. Creá un proyecto en [Firebase](https://console.firebase.google.com), agregá
   una app Android con el package `com.alquiler.app` y bajá `google-services.json`
   a `frontend/android/app/`.
2. Agregá `VITE_PUSH_ENABLED=true` a `frontend/.env.production`.
3. Cargá la service account de Firebase en la env `FIREBASE_SERVICE_ACCOUNT` del
   proyecto API y rebuildeá el APK.

### Google Sign-In (web + nativo)

Usa el mismo proyecto Firebase (`alquiler-c7f4e`) y la misma
`FIREBASE_SERVICE_ACCOUNT` del API. El front pide un ID token a Firebase Auth;
el backend lo verifica en `POST /api/auth/google` y emite los JWT propios.

1. En Firebase Console → **Authentication** → **Sign-in method** → habilitar **Google**.
2. Agregá una app **Web** al proyecto y copiá la config a las envs del front
   (`VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`,
   `MESSAGING_SENDER_ID`). En Vercel (proyecto web) y en
   `frontend/.env.production` / local `.env`.
3. **Android**: en Project settings → app Android `com.alquiler.app`, agregá el
   SHA-1 del keystore (debug y release). Volvé a bajar `google-services.json`
   (tiene que traer `oauth_client` no vacío) a `frontend/android/app/`.
4. **iOS**: creá la app iOS con el bundle id de Capacitor (`com.alquiler.app`) y
   bajá `GoogleService-Info.plist` a `frontend/ios/App/App/`.
5. Tras instalar dependencias: `cd frontend && npx cap sync`.
6. Confirmá que el API tiene `FIREBASE_SERVICE_ACCOUNT` del mismo proyecto;
   sin eso el endpoint responde 503.

Obtener SHA-1 debug:

```bash
keytool -list -v -alias androiddebugkey \
  -keystore ~/.android/debug.keystore -storepass android -keypass android
```

---

## Checklist rápido si algo falla

- ` /api/health` no responde → mirá logs del proyecto API en Vercel.
- CORS error en el browser → `CORS_ORIGIN` debe ser exactamente la URL del front (con `https://`).
- Error de Prisma / DB → `DATABASE_URL` con `sslmode=require` y `npx prisma db push` corrido.
- Upload falla → falta `BLOB_READ_WRITE_TOKEN` o el archivo pesa más de ~4 MB (límite Hobby).
- Front llama a localhost → falta `VITE_API_URL` en el proyecto web (hay que redeployar después de setearla).
- La app Android no loguea → el WebView usa el origen `https://localhost`; ya está permitido en el backend, revisá que el API esté redeployado.
- La app Android se cierra al abrirla después del login → `VITE_PUSH_ENABLED=true` sin `google-services.json`.
- Google Sign-In falla en web → faltan `VITE_FIREBASE_*` o el provider Google no está habilitado.
- `auth/unauthorized-domain` → agregá el dominio del front en Firebase Console →
  Authentication → Settings → Authorized domains (sin `https://`). Los preview de
  Vercel usan un dominio por deploy: probá en la URL de producción.
- Google Sign-In falla en Android → SHA-1 no cargado / `google-services.json` sin `oauth_client`.
- `Inicio con Google no está configurado` (503) → falta `FIREBASE_SERVICE_ACCOUNT` en el API.

---

## Desarrollo local (después de Neon)

```bash
# backend/.env con DATABASE_URL de Neon (podés crear un branch "dev" en Neon)
cd backend && npm run dev

# frontend sin VITE_API_URL → usa proxy Vite
cd frontend && npm run dev
```
