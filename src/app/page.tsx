import Image from "next/image";
import Link from "next/link";
import { LandingHeader } from "@/components/landing-header";
import { getSession, homeForRole } from "@/lib/auth/session";

const IMAGES = {
  hero: "/hero/hero1.jpg",
  objet: "/discipline/discipline3.jpg",
  cotisations: "/cotisations/cotisations2.jpg",
  prets: "/credits/credits3.jpg",
  transparence: "/transparence/transparence2.jpg",
} as const;

const VALUES = ["Solidarité", "Responsabilité", "Confiance"] as const;

const SPACES = [
  {
    title: "Membre",
    text: "Suivez vos cotisations, prêts et pénalités — en lecture seule, sans modifier les chiffres.",
  },
  {
    title: "Gestion",
    text: "Le bureau saisit la semaine, les prêts, les remboursements et la caisse.",
  },
  {
    title: "Administration",
    text: "Créez les comptes et assignez les rôles : super admin, gestionnaire, membre.",
  },
] as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--sand)]">
      <span className="tsp-accent-line inline-block h-px w-8 bg-[var(--gold)]" aria-hidden />
      {children}
    </p>
  );
}

function MediaFrame({
  src,
  alt,
  aspect = "aspect-[4/3]",
  priority,
}: {
  src: string;
  alt: string;
  aspect?: string;
  priority?: boolean;
}) {
  return (
    <div className={`group relative ${aspect} overflow-hidden rounded-2xl`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={72}
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover object-center transition duration-700 ease-out group-hover:scale-[1.04]"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#1D2D50]/25 via-transparent to-[#FFCD79]/10"
        aria-hidden
      />
    </div>
  );
}

export default async function LandingPage() {
  const session = await getSession();
  const ctaHref = session?.user ? homeForRole(session.user.role) : "/login";
  const ctaLabel = session?.user ? "Ouvrir mon espace" : "Se connecter";

  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--navy)]">
      <LandingHeader ctaHref={ctaHref} ctaLabel={ctaLabel} />

      {/* ——— HERO ——— */}
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={IMAGES.hero}
            alt=""
            fill
            priority
            quality={70}
            sizes="100vw"
            className="tsp-drift object-cover object-center"
          />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#0f1828] via-[#152238]/70 to-[#152238]/40"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffcd79' fill-opacity='0.5'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 md:pb-28 md:pt-32">
          <div className="tsp-rise">
            <Image
              src="/logo.png"
              alt="Solidarité Plus"
              width={420}
              height={168}
              className="h-auto w-[min(100%,18rem)] md:w-[min(100%,22rem)]"
              priority
            />
          </div>
          <p className="tsp-rise tsp-rise-delay-1 mt-7 max-w-xl text-base font-light leading-relaxed text-[#F4E4D7]/92 md:text-xl md:leading-relaxed">
            Épargner régulièrement pour financer ses projets, dans un cadre de solidarité,
            de responsabilité et de confiance mutuelle.
          </p>
          <div className="tsp-rise tsp-rise-delay-2 mt-9 flex flex-wrap gap-3">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-full bg-[#FFCD79] px-7 py-3.5 text-sm font-semibold text-[#1D2D50] shadow-[0_12px_40px_-12px_rgba(255,205,121,0.55)] transition hover:bg-[#ffd990] hover:shadow-[0_16px_48px_-12px_rgba(255,205,121,0.7)]"
            >
              {ctaLabel}
            </Link>
            <a
              href="#objet"
              className="inline-flex items-center justify-center rounded-full border border-[#F4E4D7]/70 bg-white/5 px-7 py-3.5 text-sm font-semibold text-[#F4E4D7] backdrop-blur-sm transition hover:border-[#F4E4D7] hover:bg-[#F4E4D7] hover:text-[#1D2D50]"
            >
              Découvrir
            </a>
          </div>
        </div>
      </section>

      {/* Objet */}
      <section id="objet" className="scroll-mt-24 bg-[var(--panel)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:gap-16 md:py-28">
          <div>
            <SectionLabel>Notre engagement</SectionLabel>
            <h2 className="max-w-md font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)] md:text-[2.75rem] md:leading-[1.15]">
              Une épargne disciplinée, au service de chacun.
            </h2>
            <p className="mt-5 max-w-md text-[var(--muted)] md:text-lg md:leading-relaxed">
              Solidarité Plus aide le groupe à cotiser régulièrement, suivre les soldes et
              renforcer trois engagements partagés.
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              {VALUES.map((v) => (
                <li key={v} className="text-sm font-semibold tracking-wide text-[var(--navy)]">
                  <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold)]" aria-hidden />
                  {v}
                </li>
              ))}
            </ul>
          </div>
          <MediaFrame src={IMAGES.objet} alt="Membres unis autour de valeurs communes" />
        </div>
      </section>

      {/* Cotisations */}
      <section id="cotisations" className="scroll-mt-24 bg-[var(--cream)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:gap-16 md:py-28">
          <div className="order-2 md:order-1">
            <MediaFrame
              src={IMAGES.cotisations}
              alt="Paiement électronique confirmé et suivi des cotisations"
            />
          </div>
          <div className="order-1 md:order-2">
            <SectionLabel>Cotisations</SectionLabel>
            <h2 className="max-w-md font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)] md:text-[2.75rem] md:leading-[1.15]">
              500 FCFA chaque dimanche.
            </h2>
            <p className="mt-5 max-w-md text-[var(--muted)] md:text-lg md:leading-relaxed">
              Plusieurs actions selon vos moyens. Paiement électronique uniquement, puis
              confirmation auprès du bureau — simple, régulier, traçable.
            </p>
            <dl className="mt-8 grid max-w-sm gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sand)]">
                  Rythme
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--navy)]">Hebdomadaire</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sand)]">
                  Canal
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--navy)]">Mobile money</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Prêts */}
      <section id="prets" className="scroll-mt-24 bg-[var(--panel)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:gap-16 md:py-28">
          <div>
            <SectionLabel>Crédits</SectionLabel>
            <h2 className="max-w-md font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)] md:text-[2.75rem] md:leading-[1.15]">
              Un prêt encadré, pour les membres à jour.
            </h2>
            <p className="mt-5 max-w-md text-[var(--muted)] md:text-lg md:leading-relaxed">
              Empruntez en principe dans la limite de votre épargne. Contrat écrit avant tout
              décaissement. Transparence sur le taux et la durée.
            </p>
            <dl className="mt-8 grid max-w-sm gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sand)]">
                  Intérêt
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--navy)]">10 % / mois</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sand)]">
                  Durée max
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--navy)]">2 mois</dd>
              </div>
            </dl>
          </div>
          <MediaFrame src={IMAGES.prets} alt="Contrat de prêt signé" />
        </div>
      </section>

      {/* Transparence */}
      <section id="transparence" className="scroll-mt-24 bg-[var(--cream)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:gap-16 md:py-28">
          <div className="order-2 md:order-1">
            <MediaFrame
              src={IMAGES.transparence}
              alt="Le bureau examine le rapport financier"
              aspect="aspect-[16/10]"
            />
          </div>
          <div className="order-1 md:order-2">
            <SectionLabel>Transparence</SectionLabel>
            <h2 className="max-w-md font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)] md:text-[2.75rem] md:leading-[1.15]">
              Une caisse lisible, en ligne et en réunion.
            </h2>
            <p className="mt-5 max-w-md text-[var(--muted)] md:text-lg md:leading-relaxed">
              Le bureau gère les fonds. Un rapport mensuel informe le groupe. Sur la plateforme,
              chaque membre voit sa progression : cotisations, prêts et soldes.
            </p>
          </div>
        </div>
      </section>

      {/* Espaces */}
      <section id="espaces" className="scroll-mt-24 border-t border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <SectionLabel>La plateforme</SectionLabel>
          <h2 className="max-w-xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)] md:text-[2.75rem] md:leading-[1.15]">
            Trois espaces, un même fil rouge : la clarté.
          </h2>
          <div className="mt-14 grid gap-0 md:grid-cols-3">
            {SPACES.map((item, i) => (
              <div
                key={item.title}
                className={`border-[var(--line)] py-8 md:px-8 md:py-2 ${
                  i > 0 ? "border-t md:border-t-0 md:border-l" : ""
                }`}
              >
                <p className="font-[family-name:var(--font-display)] text-5xl font-bold text-[var(--gold)]/80">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                  {item.title}
                </h3>
                <p className="mt-3 leading-relaxed text-[var(--muted)]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#1D2D50] text-[#F4E4D7]">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFCD79]/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-[#D09C79]/20 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 md:flex-row md:items-end md:justify-between md:py-28">
          <div>
            <SectionLabel>Accès</SectionLabel>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-[2.75rem] md:leading-[1.15]">
              Prêt à ouvrir votre espace ?
            </h2>
            <p className="mt-4 max-w-md text-[#F4E4D7]/75 md:text-lg">
              Connexion sécurisée pour les membres et le bureau de Solidarité Plus.
            </p>
          </div>
          <Link
            href={ctaHref}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#FFCD79] px-8 py-3.5 text-sm font-semibold text-[#1D2D50] shadow-[0_12px_40px_-12px_rgba(255,205,121,0.45)] transition hover:bg-[#ffd990]"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      <footer className="relative overflow-hidden bg-[#152238] text-[#F4E4D7]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFCD79]/50 to-transparent"
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-16 md:pt-20">
          <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
            <div>
              <Link href="/" className="inline-block transition hover:opacity-90">
                <Image
                  src="/logo.png"
                  alt="Solidarité Plus"
                  width={160}
                  height={64}
                  className="h-12 w-auto"
                />
              </Link>
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#F4E4D7]/65">
                Plateforme de gestion pour cotisations, prêts et soldes — claire pour chaque
                membre.
              </p>
              <Link
                href={ctaHref}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-[#FFCD79] px-5 py-2.5 text-sm font-semibold text-[#1D2D50] transition hover:bg-[#ffd990]"
              >
                {ctaLabel}
              </Link>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
                Découvrir
              </p>
              <ul className="mt-5 space-y-3 text-sm text-[#F4E4D7]/75">
                <li>
                  <a href="#objet" className="transition hover:text-[#FFCD79]">
                    Notre engagement
                  </a>
                </li>
                <li>
                  <a href="#cotisations" className="transition hover:text-[#FFCD79]">
                    Cotisations
                  </a>
                </li>
                <li>
                  <a href="#prets" className="transition hover:text-[#FFCD79]">
                    Crédits
                  </a>
                </li>
                <li>
                  <a href="#transparence" className="transition hover:text-[#FFCD79]">
                    Transparence
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
                Accès
              </p>
              <ul className="mt-5 space-y-3 text-sm text-[#F4E4D7]/75">
                <li>
                  <a href="#espaces" className="transition hover:text-[#FFCD79]">
                    Espaces plateforme
                  </a>
                </li>
                <li>
                  <Link href="/login" className="transition hover:text-[#FFCD79]">
                    Connexion
                  </Link>
                </li>
                <li>
                  <Link href={ctaHref} className="transition hover:text-[#FFCD79]">
                    {ctaLabel}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-[#F4E4D7]/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Solidarité Plus. Tous droits réservés.</p>
            <p className="tracking-wide">Confiance · Épargne · Croissance</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
