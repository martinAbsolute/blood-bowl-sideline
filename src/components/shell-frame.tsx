import type { ReactNode } from "react";

/** Shared geometry keeps the provider fallback and hydrated shell in place. */
export function ShellFrame({
  header,
  sidebar,
  footer,
  children,
  sidebarOpen = true,
}: {
  header: ReactNode;
  sidebar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  sidebarOpen?: boolean;
}) {
  return (
    <div className="site-shell" data-sidebar-open={sidebarOpen}>
      {header}
      <div className="site-shell-body grid flex-1 grid-cols-[minmax(0,1fr)] print:block">
        <aside
          id="site-sidebar"
          className="site-sidebar no-print hidden border-r bg-card/50 lg:block"
        >
          <div className="site-sidebar-body">{sidebar}</div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <main className="flex-1">{children}</main>
          {footer}
        </div>
      </div>
    </div>
  );
}
