"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type RegisterResponse = {
  success?: boolean;
  token?: string;
  user?: Record<string, unknown>;
  error?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const appId = Number(process.env.NEXT_PUBLIC_APP_ID);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phoneFromQuery = params.get("phone");
    if (phoneFromQuery) {
      setPhone(phoneFromQuery);
    }
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          password,
          appId: Number.isInteger(appId) ? appId : undefined,
        }),
      });

      const data = (await res.json()) as RegisterResponse;
      if (!res.ok || !data.success || !data.token) {
        setError(data.error ?? "Registration failed");
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
      setError("Unable to register right now");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center bg-slate-800 px-4 py-6">
      <section className="w-full p-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
          Get Started
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Registration</h1>
        <p className="mt-1 text-sm text-slate-300">Create your account to continue.</p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm text-slate-200">Name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border-0 border-b border-slate-500 bg-transparent px-1 py-3 text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-indigo-300"
              placeholder="Enter your name"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">
              Phone Number
            </span>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full border-0 border-b border-slate-500 bg-transparent px-1 py-3 text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-indigo-300"
              placeholder="Enter phone number"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border-0 border-b border-slate-500 bg-transparent px-1 py-3 text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-indigo-300"
              placeholder="Create password"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mx-auto block w-2/3 rounded-2xl bg-indigo-500 px-4 py-3 font-semibold text-white shadow-md shadow-indigo-900/30 transition hover:bg-indigo-400 active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Creating account..." : "SIGN UP"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-300">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-300 hover:underline">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
