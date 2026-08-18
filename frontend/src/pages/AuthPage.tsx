import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api, setTokens } from "../lib/api";
import { signInWithGoogle } from "../lib/googleAuth";
import { KeyIcon } from "../components/icons";
import { toast } from "../components/Toast";
import {
  Button,
  ErrorText,
  Field,
  PasswordInput,
  inputClass,
} from "../components/ui";
import type { User } from "../types";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthPage({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, name, phone });
      setTokens(res.accessToken, res.refreshToken);
      onAuth(await api.me());
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo autenticar";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const res = await api.loginWithGoogle({ idToken });
      setTokens(res.accessToken, res.refreshToken);
      onAuth(await api.me());
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "auth/popup-closed-by-user"
      ) {
        return;
      }
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo iniciar con Google";
      setError(message);
      toast.error(message);
    } finally {
      setGoogleLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <div className="min-h-dvh bg-brand-700">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex items-center gap-3 text-white">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
            <KeyIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl">Rently</h1>
            <p className="text-sm text-brand-100">
              Propiedades, facturas y reclamos en un solo lugar.
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-float">
          <h2 className="text-xl">
            {mode === "login" ? "Iniciá sesión" : "Creá tu cuenta"}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {mode === "login"
              ? "Entrá para ver tus propiedades."
              : "Registrate como dueño o inquilino."}
          </p>

          <form className="mt-5 space-y-3" onSubmit={submit}>
            {mode === "register" && (
              <>
                <Field label="Nombre">
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                  />
                </Field>
                <Field
                  label="Teléfono"
                  hint="Con código de área. Sirve para que te llamen o escriban por WhatsApp."
                >
                  <input
                    className={inputClass}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="11 5555 0101"
                    required
                  />
                </Field>
              </>
            )}
            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vos@email.com"
                required
              />
            </Field>
            <Field label="Contraseña">
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </Field>

            <ErrorText>{error}</ErrorText>

            <Button block loading={loading} disabled={busy} className="mt-1">
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-ink-400">
            <span className="h-px flex-1 bg-sand-200" />
            o
            <span className="h-px flex-1 bg-sand-200" />
          </div>

          <Button
            type="button"
            variant="secondary"
            block
            loading={googleLoading}
            disabled={busy}
            onClick={onGoogle}
            className="gap-2"
          >
            {!googleLoading && <GoogleGlyph className="size-5 shrink-0" />}
            Continuar con Google
          </Button>

          <p className="mt-4 text-center text-sm text-ink-500">
            {mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <button
              type="button"
              className="font-semibold text-brand-600"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Registrate" : "Iniciá sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
