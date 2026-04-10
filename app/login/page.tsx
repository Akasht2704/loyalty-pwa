"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type LoginResponse = {
  success?: boolean;
  token?: string;
  user?: Record<string, unknown>;
  requiresRegistration?: boolean;
  requiresPassword?: boolean;
  phone?: string;
  error?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const appId = Number(process.env.NEXT_PUBLIC_APP_ID);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          password: showPasswordStep ? password : undefined,
          appId: Number.isInteger(appId) ? appId : undefined,
        }),
      });

      const data = (await res.json()) as LoginResponse;

      if (data.requiresRegistration) {
        router.push(`/register?phone=${encodeURIComponent(phone)}`);
        return;
      }

      if (data.requiresPassword) {
        setShowPasswordStep(true);
        return;
      }

      if (!res.ok || !data.success || !data.token) {
        setError(data.error ?? "Login failed");
        return;
      }

      const signInResult = await signIn("credentials", {
        redirect: false,
        token: data.token,
        user: JSON.stringify(data.user ?? {}),
      });
      if (signInResult?.error) {
        setError("Unable to establish session");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Unable to login right now");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center bg-zinc-100 px-4 py-6">
      <section className="w-full p-2">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Welcome Back
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            Login
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {showPasswordStep
              ? "Phone verified. Enter your password to continue."
              : "Enter your phone number to continue."}
          </p>
        </div>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm text-zinc-700">
              Phone Number
            </span>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={showPasswordStep}
              className="mt-1 w-full border-0 border-b border-zinc-300 bg-transparent px-1 py-3 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500"
              placeholder="Enter phone number"
            />
          </label>

          {showPasswordStep ? (
            <label className="block">
              <span className="text-sm text-zinc-700">
                Password
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full border-0 border-b border-zinc-300 bg-transparent px-1 py-3 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500"
                placeholder="Enter password"
              />
            </label>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mx-auto block w-2/3 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Checking..." : showPasswordStep ? "SIGN IN" : "Continue"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-500">
          Secure access for your loyalty account
        </p>
      </section>
    </main>
  );
}
