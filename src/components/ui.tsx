import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

export function Shell({
  title,
  nav,
  children,
  userName,
  roleLabel,
}: {
  title: string;
  nav: { href: string; label: string }[];
  children: ReactNode;
  userName?: string;
  roleLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0">
              <Image src="/logo.png" alt="Solidarité Plus" width={140} height={56} className="h-10 w-auto" />
            </Link>
            <p className="text-sm text-[var(--muted)]">{title}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {userName && (
              <span className="text-[var(--muted)]">
                {userName}
                {roleLabel ? ` · ${roleLabel}` : ""}
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[var(--muted)]">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--brand)]">{value}</p>
    </Card>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles =
    variant === "primary"
      ? "bg-[var(--brand)] text-[#F4E4D7] hover:bg-[var(--brand-dark)]"
      : variant === "danger"
        ? "bg-red-700 text-white hover:bg-red-800"
        : "border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface)]";
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none ring-[var(--brand)] focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none ring-[var(--brand)] focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{children}</label>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-medium ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`border-b border-[var(--line)] px-3 py-2 align-middle ${className}`}>{children}</td>;
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  const colors =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-[var(--line)] bg-[var(--brand-soft)] text-[var(--brand-dark)]";
  return <div className={`rounded-md border px-3 py-2 text-sm ${colors}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-[var(--muted)]">{children}</p>;
}
