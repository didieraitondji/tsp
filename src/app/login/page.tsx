"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { PhoneInput } from "@/components/phone-input";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      phone: String(fd.get("phone")),
      password: String(fd.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Numéro ou mot de passe incorrect.");
      return;
    }
    router.refresh();
    router.push("/login/redirect");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#152238] text-[var(--navy)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/hero/hero1.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f1828] via-[#152238]/92 to-[#1D2D50]/88" />
        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[#FFCD79]/15 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[#D09C79]/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="transition hover:opacity-90">
            <Image
              src="/logo.png"
              alt="Solidarité Plus"
              width={150}
              height={60}
              className="h-10 w-auto md:h-11"
              priority
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#F4E4D7]/30 px-4 py-2 text-sm font-medium text-[#F4E4D7]/85 transition hover:border-[#FFCD79] hover:text-[#FFCD79]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Accueil
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-10 md:py-14">
          <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#F4E4D7]/95 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)] backdrop-blur-md md:grid-cols-2">
            <div className="relative hidden min-h-[28rem] md:block">
              <Image
                src="/discipline/discipline3.jpg"
                alt=""
                fill
                sizes="50vw"
                className="object-cover object-center"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#152238] via-[#152238]/55 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-8 text-[#F4E4D7]">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                  Espace membre
                </p>
                <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold leading-snug">
                  Cotisations, prêts et soldes — visibles en un coup d’œil.
                </p>
                <p className="mt-3 text-sm text-[#F4E4D7]/70">
                  Confiance · Épargne · Croissance
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-center px-6 py-10 sm:px-10 md:px-12 md:py-14">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
                <LogIn className="h-3.5 w-3.5" strokeWidth={2} />
                Connexion
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)] md:text-4xl">
                Bienvenue
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)] md:text-base">
                Connectez-vous avec votre numéro de téléphone.
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-[var(--navy)]">
                    Téléphone
                  </label>
                  <PhoneInput id="phone" name="phone" required />
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-[var(--navy)]"
                  >
                    Mot de passe
                  </label>
                  <PasswordInput name="password" required autoComplete="current-password" />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1D2D50] px-6 py-3.5 text-sm font-semibold text-[#F4E4D7] shadow-[0_12px_32px_-12px_rgba(29,45,80,0.55)] transition hover:bg-[#152238] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                      Connexion…
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" strokeWidth={2} />
                      Se connecter
                    </>
                  )}
                </button>
              </form>

              <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[var(--muted)]">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--sand)]" strokeWidth={1.75} />
                Accès par numéro · Compte créé par l’administration
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
