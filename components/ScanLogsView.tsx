"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ScanListItem = {
  id: number;
  qrCode: string;
  productName: string | null;
  userRoleName: string | null;
  scanState: string | null;
  createdAt: string | null;
};

type ScanDetail = {
  id: number;
  qrCode: string;
  userName: string;
  userPhone: string;
  userRoleName: string | null;
  scanState: string | null;
  scanDistrict: string | null;
  scanCity: string | null;
  brandId: number | null;
  longitude: number | null;
  latitude: number | null;
  productId: number | null;
  productName: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
  mrp: number | null;
  scanCategoryId: number | null;
  scanSubCategoryId: number | null;
  createdAt: string | null;
  scanData: unknown;
};

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ScanLogsView() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const defaults = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [rows, setRows] = useState<ScanListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(`/api/scan-logs?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as { success?: boolean; data?: ScanListItem[]; error?: string };
      if (!res.ok) {
        setRows([]);
        setError(typeof body.error === "string" ? body.error : "Could not load scans");
        return;
      }
      setRows(Array.isArray(body.data) ? body.data : []);
    } catch (e) {
      setRows([]);
      setError((e as Error).message || "Could not load scans");
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    if (status === "authenticated" && token) {
      void loadList();
    }
  }, [status, token, loadList]);

  const openDetail = async (id: number) => {
    if (!token) return;
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/scan-logs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as { success?: boolean; data?: ScanDetail; error?: string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not load details");
        return;
      }
      if (body.data) setDetail(body.data);
    } catch (e) {
      setError((e as Error).message || "Could not load details");
    } finally {
      setDetailLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
    );
  }

  if (status !== "authenticated" || !token) {
    return (
      <section className="w-full p-1">
        <p className="text-sm text-slate-300">
          Log in to see QR codes you have scanned and their details.
        </p>
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
    <>
      <section className="flex min-h-0 w-full flex-1 flex-col p-1 [color-scheme:dark]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Date range</p>
        <p className="mt-1 text-sm text-slate-300">Choose dates, then apply to refresh the list.</p>

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
          <label className="block min-w-[140px] flex-1">
            <span className="text-sm text-slate-200">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full border-0 border-b border-slate-500 bg-transparent py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-300"
            />
          </label>
          <label className="block min-w-[140px] flex-1">
            <span className="text-sm text-slate-200">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full border-0 border-b border-slate-500 bg-transparent py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-300"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadList()}
            disabled={loading}
            className="mx-auto block min-w-[8rem] rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-900/30 transition hover:bg-indigo-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:mx-0"
          >
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="hide-scrollbar mt-8 min-h-0 flex-1 overflow-y-auto overflow-x-auto max-h-[min(60vh,26rem)] sm:max-h-none">
          <table className="w-full min-w-[260px] border-collapse text-left text-xs sm:text-sm">
            <thead className="sticky top-0 z-[1] border-b border-slate-600 bg-[#17121f]">
              <tr>
                <th className="py-2 pr-2 font-medium text-slate-400">QR code</th>
                <th className="w-20 py-2 pr-4 text-right font-medium text-slate-400 sm:w-24 sm:pr-5"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-slate-500">
                    No scans in this range.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-700/80 text-slate-200">
                    <td
                      className="break-all py-2.5 pr-2 font-mono text-[11px] text-slate-100 sm:text-xs"
                      title={r.qrCode}
                    >
                      {r.qrCode?.trim() || "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-right align-top sm:pr-5">
                      <button
                        type="button"
                        onClick={() => void openDetail(r.id)}
                        className="text-xs font-medium text-indigo-300 hover:underline sm:text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(detail != null || detailLoading) && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scan-detail-title"
          onClick={() => {
            setDetail(null);
            setDetailLoading(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-indigo-100/80 bg-white p-5 shadow-xl shadow-indigo-950/10 dark:border-zinc-600 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 id="scan-detail-title" className="text-lg font-semibold text-zinc-900 dark:text-white">
                Scan details
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setDetailLoading(false);
                }}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {detailLoading && <p className="text-sm text-zinc-500">Loading…</p>}

            {detail && !detailLoading && (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">When</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">{formatWhen(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">QR code</dt>
                  <dd className="break-all font-mono text-xs text-zinc-900 dark:text-zinc-100">{detail.qrCode}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Product name</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">{detail.productName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">MRP</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {detail.mrp != null && Number.isFinite(detail.mrp) ? `INR ${detail.mrp}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Category</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">{detail.categoryName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Sub-category</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">{detail.subCategoryName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Role</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">{detail.userRoleName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Location</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {[detail.scanCity, detail.scanDistrict, detail.scanState].filter(Boolean).join(", ") ||
                      "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Brand ID</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {detail.brandId != null ? String(detail.brandId) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Coordinates</dt>
                  <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                    {detail.latitude != null && detail.longitude != null
                      ? `${detail.latitude}, ${detail.longitude}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Product ID</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {detail.productId != null ? String(detail.productId) : "—"}
                  </dd>
                </div>
                {detail.scanData != null && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Scan data</dt>
                    <dd>
                      <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-zinc-100 p-2 text-[11px] text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                        {typeof detail.scanData === "string"
                          ? detail.scanData
                          : JSON.stringify(detail.scanData, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>
      )}
    </>
  );
}
