import { Link, useMatchRoute } from "@tanstack/react-router";
import { BookMarked, BookOpen, PenLine, Undo2 } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useProgress } from "@/lib/german/store";

const items = [
  { to: "/", label: "Desk", icon: BookOpen, exact: true },
  { to: "/practice", label: "Study", icon: PenLine, exact: false },
  { to: "/dictionary", label: "Dictionary", icon: BookMarked, exact: false },
  { to: "/corrections", label: "Corrections", icon: Undo2, exact: false },
] as const;

export function Shell({ bare = false, children }: { bare?: boolean; children: ReactNode }) {
  const hydrate = useProgress((state) => state.hydrate);
  const mistakes = useProgress((state) => state.data.mistakes.length);
  const matchRoute = useMatchRoute();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (bare) {
    return <div className="min-h-dvh bg-bg text-ink">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-bg text-ink md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line md:flex md:min-h-dvh md:flex-col md:px-4 md:py-6">
        <p className="px-3 font-display text-2xl tracking-tight">Klarheft</p>
        <p className="px-3 pt-1 text-sm text-muted">German, plainly.</p>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Primary">
          {items.map((item) => (
            <NavLink key={item.to} {...item} matchRoute={matchRoute} count={item.to === "/corrections" ? mistakes : 0} />
          ))}
        </nav>
      </aside>
      <div className="min-w-0 pb-24 md:pb-0">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:m-3 focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <main id="content">{children}</main>
      </div>
      <nav
        className="pad-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface md:hidden"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-4">
          {items.map((item) => {
            const on = Boolean(matchRoute({ to: item.to, fuzzy: !item.exact }));
            const Icon = item.icon;
            const count = item.to === "/corrections" ? mistakes : 0;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  search={item.to === "/practice" ? { mode: "mix", len: 8 } : undefined}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium",
                    on ? "text-pine" : "text-muted",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span>
                    {item.label}
                    {count > 0 ? <span className="tabular-nums"> {count}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  exact,
  matchRoute,
  count,
}: {
  to: "/" | "/practice" | "/dictionary" | "/corrections";
  label: string;
  icon: typeof BookOpen;
  exact: boolean;
  matchRoute: ReturnType<typeof useMatchRoute>;
  count: number;
}) {
  const on = Boolean(matchRoute({ to, fuzzy: !exact }));
  return (
    <Link
      to={to}
      search={to === "/practice" ? { mode: "mix", len: 8 } : undefined}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
        on ? "bg-soft text-ink" : "text-muted hover:bg-soft hover:text-ink",
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="flex-1">{label}</span>
      {count > 0 ? <span className="tabular-nums text-faint">{count}</span> : null}
    </Link>
  );
}
