import Link from "next/link";
import { HomePageShell } from "@/components/sections/HomePageShell";
import { LoyaltyBrandSelectionView } from "@/components/LoyaltyBrandSelectionView";

export const metadata = {
  title: "Select brand",
};

export default function LoyaltyBrandSelectionPage() {
  return (
    <HomePageShell fillViewport>
      <header className="shrink-0 px-4 pb-3 pt-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl font-medium text-white/90 transition hover:bg-white/10 active:bg-white/5"
            aria-label="Back to home"
          >
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-white">Select brand</h1>
            <p className="text-xs text-zinc-400">Choose brand before loyalty</p>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <LoyaltyBrandSelectionView />
      </main>
    </HomePageShell>
  );
}
