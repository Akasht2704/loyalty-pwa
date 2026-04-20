"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type BrandOption = {
  brandId: number;
  brandName: string;
  roleId: number | null;
  roleName: string | null;
};

export function LoyaltyBrandSelectionView() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;

    let isMounted = true;
    const loadBrands = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/user-brands", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json()) as {
          data?: BrandOption[];
          error?: string;
        };

        if (!res.ok) {
          if (isMounted) {
            setBrands([]);
            setError(typeof body.error === "string" ? body.error : "Could not load brands");
          }
          return;
        }

        if (isMounted) {
          setBrands(Array.isArray(body.data) ? body.data : []);
        }
      } catch (e) {
        if (isMounted) {
          setBrands([]);
          setError((e as Error).message || "Could not load brands");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadBrands();
    return () => {
      isMounted = false;
    };
  }, [status, token]);

  if (status === "loading") {
    return <p className="py-8 text-center text-sm text-slate-400">Loading…</p>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <section className="w-full p-1">
        <p className="text-sm text-slate-300">Log in to select a brand and view your loyalty points.</p>
        <Link
          href="/login"
          className="mx-auto mt-6 block w-2/3 rounded-2xl bg-indigo-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-md shadow-indigo-900/30 transition hover:bg-indigo-400 active:scale-[0.99]"
        >
          Login
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full p-1 [color-scheme:dark]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Choose brand</p>
      <p className="mt-1 text-sm text-slate-300">
        Select a brand to view loyalty points earned only for that brand.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading brands…</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {brands.length === 0 ? (
            <p className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-3 text-sm text-zinc-300">
              No brands found for your account.
            </p>
          ) : (
            brands.map((brand) => (
              <Link
                key={brand.brandId}
                href={`/loyalty?brand_id=${brand.brandId}`}
                className="rounded-2xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 transition hover:border-indigo-400/70 hover:bg-zinc-900/70"
              >
                <p className="text-base font-semibold text-zinc-100">{brand.brandName}</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {brand.roleName ? `Role: ${brand.roleName}` : "View brand points"}
                </p>
              </Link>
            ))
          )}
        </div>
      )}
    </section>
  );
}
