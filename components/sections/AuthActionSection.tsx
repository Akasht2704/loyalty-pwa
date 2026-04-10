"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function AuthActionSection() {
  const { status } = useSession();

  return (
    <section className="px-4 pb-5 pt-2">
      {status === "authenticated" ? (
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full rounded-2xl border border-zinc-700/60 bg-zinc-900/70 px-5 py-3 text-sm font-semibold text-white shadow-lg transition active:scale-[0.99] hover:bg-zinc-800"
        >
          Logout
        </button>
      ) : (
        <Link
          href="/login"
          className="block w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition active:scale-[0.99] hover:from-indigo-400 hover:to-violet-500"
        >
          Login to your account
        </Link>
      )}
    </section>
  );
}
