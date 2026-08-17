# Alquiler

Gestión de propiedades alquiladas para dueños e inquilinos.

- **Web:** React + Vite (deploy en Vercel)
- **API:** Node.js + Express + Prisma + Postgres (Neon) en Vercel
- **Móvil:** Capacitor (Android / iOS) apuntando a la API en la nube
- **Archivos:** Vercel Blob en prod / disco local en dev

## Deploy en la nube

Seguí la guía completa: **[DEPLOY.md](./DEPLOY.md)** (Neon + 2 proyectos Vercel + Blob + APK).

## Setup local

Necesitás una `DATABASE_URL` de Postgres (Neon free alcanza también para local).

```bash
# Backend
cd backend
cp .env.example .env   # pegá tu DATABASE_URL de Neon
npm install
npx prisma db push
npm run dev            # http://localhost:3001

# Frontend (otra terminal)
cd frontend
cp .env.example .env   # VITE_API_URL vacío = proxy a :3001
npm install
npm run dev            # http://localhost:5173
```

## Variables de entorno (backend)

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres (Neon) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Firmas JWT |
| `CORS_ORIGIN` / `APP_URL` | Origen del frontend (coma-separados si hay varios) |
| `BLOB_READ_WRITE_TOKEN` | Uploads en Vercel Blob (prod) |
| `CRON_SECRET` | Protege `/api/jobs/*` |
| `SMTP_*` | Email de respaldo si un aviso no se leyó |
| `FIREBASE_SERVICE_ACCOUNT` | Push FCM/APNs (opcional) |

Sin SMTP/Firebase/Blob en local, la API sigue andando (archivos en `uploads/`).

## Flujo rápido de prueba

1. Registrá un **dueño** y un **inquilino** (emails distintos).
2. Como dueño: creá edificio → unidad → asigná inquilino por email → contrato → facturas → **Avisar al inquilino**.
3. Como inquilino: mirá **Avisos**, subí comprobante, creá un reclamo.
4. Como dueño: aprobá el pago y respondé el reclamo.

## App móvil (Capacitor)

Con la API ya en Vercel:

```bash
cd frontend
# .env.production con VITE_API_URL=https://tu-api.vercel.app
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

Detalle en [DEPLOY.md](./DEPLOY.md) paso 7.

## Scripts útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| backend | `npm run dev` | API local con reload |
| frontend | `npm run dev` | Web + proxy `/api` → `:3001` |
| frontend | `npm run build` | Build para Capacitor / Vercel |
| backend | `npx prisma studio` | Explorar DB |
| backend | `npx prisma db push` | Sincronizar schema a Neon |
