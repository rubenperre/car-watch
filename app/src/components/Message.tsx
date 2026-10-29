import type { ReactNode } from "react";

export function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="wrap narrow">
      <h1>{title}</h1>
      <div className="stack">{children}</div>
    </div>
  );
}
