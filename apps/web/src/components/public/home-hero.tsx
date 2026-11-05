import type { Home } from "@bsv-sws/validation";
import Link from "next/link";

/**
 * Home banner of bsv-sws.de: navy area with logo and title, photo fading in from
 * the right (hidden on phones), button to the next event or a custom target.
 * Content is edited in Studio (Inhalte → Startseite); colours: --hero-* tokens.
 */
export function HomeHero({ hero }: { hero: NonNullable<Home["hero"]> }) {
  const button = hero.button;
  return (
    <section className="relative isolate overflow-hidden bg-hero text-hero-foreground">
      {hero.imageId && (
        <div aria-hidden className="absolute inset-y-0 right-0 -z-10 hidden w-[70%] md:block">
          {/* eslint-disable-next-line @next/next/no-img-element -- proxied CMS media with width transform */}
          <img
            src={`/medien/${hero.imageId}?width=1920`}
            alt=""
            className="size-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-linear-to-r from-hero via-hero/40 via-30% to-transparent" />
        </div>
      )}
      <div className="flex min-h-56 flex-col justify-center gap-6 px-6 py-10 md:min-h-[min(calc(100svh-100px),50rem)] md:max-w-[55%]">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG */}
        <img
          src="/logo-bsv.svg"
          alt=""
          width={200}
          height={75}
          className="hidden w-[200px] sm:block"
        />
        <p className="flex flex-col gap-1 font-bold">
          {hero.kicker && (
            <span className="text-xl text-hero-accent sm:text-3xl">{hero.kicker}</span>
          )}
          <span className="text-2xl sm:text-4xl">{hero.title}</span>
        </p>
        {button && (
          <Link
            href={button.href}
            {...(button.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="group inline-flex w-fit items-center gap-2 rounded-full bg-hero-accent px-4 py-2 text-sm text-hero-foreground sm:text-base"
          >
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              ›
            </span>
            {button.label}
          </Link>
        )}
      </div>
    </section>
  );
}
