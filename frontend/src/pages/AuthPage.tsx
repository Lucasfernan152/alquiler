import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api, setTokens } from "../lib/api";
import { KeyIcon } from "../components/icons";
import {
  Button,
  ErrorText,
  Field,
  PasswordInput,
  inputClass,
} from "../components/ui";
import type { User } from "../types";

export function AuthPage({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError(err instanceof ApiError ? err.message : "No se pudo autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-brand-700">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex items-center gap-3 text-white">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
            <KeyIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl">Alquiler</h1>
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

            <Button block loading={loading} className="mt-1">
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

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
