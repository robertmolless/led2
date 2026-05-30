import type { ReactNode } from "react";

interface Props {
  title: string;
  toolbar: ReactNode;
  inputs: ReactNode;
  results: ReactNode;
  scheme: ReactNode;
  warnings: ReactNode;
}

export function AppShell({ title, toolbar, inputs, results, scheme, warnings }: Props) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">{title}</div>
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
