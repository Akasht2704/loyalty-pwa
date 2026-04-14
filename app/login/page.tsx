"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type LoginResponse = {
  success?: boolean;
  token?: string;
  user?: Record<string, unknown>;
  requiresRegistration?: boolean;
  requiresOtp?: boolean;
  requiresBrandSelection?: boolean;
  brandOptions?: Array<{
    brandId: number;
    brandName: string;
    roleId: number;
    roleName: string;
  }>;
  existingUser?: boolean;
  phone?: string;
  error?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const appId = Number(process.env.NEXT_PUBLIC_APP_ID);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [brandOptions, setBrandOptions] = useState<
    Array<{ brandId: number; brandName: string; roleId: number; roleName: string }>
  >([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
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
          otp: showOtpStep ? otp : undefined,
          brandId:
            showOtpStep && selectedBrandId
              ? Number(selectedBrandId)
              : undefined,
          appId: Number.isInteger(appId) ? appId : undefined,
        }),
      });

      const data = (await res.json()) as LoginResponse;

      if (data.requiresRegistration) {
        const targetPhone = data.phone ?? phone;
        const params = new URLSearchParams({
          phone: targetPhone,
        });
        if (data.existingUser) {
          params.set("existing", "1");
        }
        router.push(`/register?${params.toString()}`);
        return;
      }

      if (data.requiresOtp) {
        setShowOtpStep(true);
        setBrandOptions([]);
        setSelectedBrandId("");
        return;
      }

      if (data.requiresBrandSelection) {
        const options = Array.isArray(data.brandOptions) ? data.brandOptions : [];
        setBrandOptions(options);
        setSelectedBrandId(options[0] ? String(options[0].brandId) : "");
        setShowOtpStep(true);
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
    <main className="mx-auto grid min-h-screen w-full max-w-lg grid-rows-[auto_1fr] bg-slate-800">
      <p className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 text-center text-2xl font-semibold tracking-[0.2em] text-slate-100">
        WELCOME
      </p>
      <div className="flex min-h-0 items-center justify-center px-4 py-6">
        <section className="w-full p-2">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
              Welcome Back
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-100">
              Login
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {showOtpStep
                ? "Enter the OTP sent to your phone to continue."
                : "Enter your phone number to continue."}
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="text-sm text-slate-200">
                Phone Number
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={showOtpStep}
                className="mt-1 w-full border-0 border-b border-slate-500 bg-transparent px-1 py-3 text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-indigo-300"
                placeholder="Enter phone number"
              />
            </label>

            {showOtpStep ? (
              <>
                <label className="block">
                  <span className="text-sm text-slate-200">
                    OTP
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={8}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="mt-1 w-full border-0 border-b border-slate-500 bg-transparent px-1 py-3 text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-indigo-300"
                    placeholder="Enter OTP"
                  />
                </label>
                {brandOptions.length > 1 ? (
                  <label className="block">
                    <span className="text-sm text-slate-200">
                      Select Brand
                    </span>
                    <select
                      required
                      value={selectedBrandId}
                      onChange={(e) => setSelectedBrandId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-500 bg-slate-900 px-2 py-3 text-slate-100 outline-none transition focus:border-indigo-300"
                    >
                      {brandOptions.map((opt) => (
                        <option key={opt.brandId} value={String(opt.brandId)}>
                          {`${opt.brandName} (${opt.roleName})`}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}

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
              {loading ? "Checking..." : showOtpStep ? "SIGN IN" : "Continue"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            Secure access for your loyalty account
          </p>
        </section>
      </div>
    </main>
  );
}
