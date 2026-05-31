import type { ReactNode } from "react";

interface Props {
  toolbar: ReactNode;
  inputs: ReactNode;
  results: ReactNode;
  scheme: ReactNode;
  warnings: ReactNode;
}

export function AppShell({ toolbar, inputs, results, scheme, warnings }: Props) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-toolbar">{toolbar}</div>
      </header>
      <main className="app-main">
        <aside className="sidebar sidebar-left">
          {inputs}
        </aside>
        <section className="center">
          {warnings}
          {scheme}
        </section>
        <aside className="sidebar sidebar-right">
          {results}
        </aside>
      </main>
    </div>
  );
}
