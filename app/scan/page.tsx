// import Link from "next/link";
// import { QrScanner } from "@/components/QrScanner";

// export const metadata = {
//   title: "Scan QR",
// };

// export default function ScanPage() {
//   return (
//     <div className="flex min-h-full flex-col bg-zinc-50 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-zinc-950">
//       <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-zinc-50/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
//         <div className="mx-auto flex max-w-lg items-center gap-3">
//           <Link
//             href="/"
//             className="rounded-lg px-2 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
//           >
//             ← Back
//           </Link>
//           <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Scan QR code</h1>
//         </div>
//       </header>
//       <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
//         <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
//           Point your camera at a QR code. Works best over HTTPS or on localhost.
//         </p>
//         <QrScanner />
//       </main>
//     </div>
//   );
// }

import Link from "next/link";
import { ScanPermissionGate } from "../../components/ScanPermissionGate";

export const metadata = {
  title: "Scan QR",
};

export default function ScanPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-medium text-zinc-500 transition hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ←
          </Link>
          
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Scan QR Code
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Earn points instantly</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8">
        {/* Instruction Card */}
        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              ℹ︎
            </div>
            <div className="text-sm">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                Point your camera at the QR code
              </p>
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                Make sure the code is well-lit and fully inside the frame
              </p>
            </div>
          </div>
        </div>

        {/* QR Scanner Area */}
        <div className="flex-1">
          <ScanPermissionGate />
        </div>

        {/* Footer Tip */}
        <div className="mt-10 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Works best in bright light • HTTPS required in production
          </p>
        </div>
      </main>
    </div>
  );
}
