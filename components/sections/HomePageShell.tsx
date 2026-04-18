import type { ReactNode } from "react";

type HomePageShellProps = {
  children: ReactNode;
  /**
   * When true, shell fills the viewport and clips overflow so nested `overflow-auto`
   * regions (e.g. tables) scroll instead of the document — avoids a page-level scrollbar.
   */
  fillViewport?: boolean;
};

export function HomePageShell({ children, fillViewport = false }: HomePageShellProps) {
  return (
    <div
      className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-950 ${
        fillViewport ? "h-dvh min-h-0" : "min-h-full"
      }`}
    >
      <div
        className={`relative mx-auto flex w-full max-w-lg flex-col bg-[#17121f] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] ${
          fillViewport ? "h-full min-h-0 overflow-hidden" : "min-h-full"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
