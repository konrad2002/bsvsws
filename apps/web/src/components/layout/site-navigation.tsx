import type { NavItem } from "@bsv-sws/validation";
import Link from "next/link";

/**
 * Database-managed navigation (spec §9.2) in the style of bsv-sws.de.
 * Desktop: hover/focus dropdowns; mobile: a native <details> menu (works
 * without JavaScript). Colours: --header-* tokens.
 */
function NavLink({
  item,
  className,
  dropdown = false,
}: {
  item: NavItem;
  className?: string;
  /** Shows the ▾ marker (decorative, not part of the accessible name). */
  dropdown?: boolean;
}) {
  const label = (
    <>
      {item.label}
      {dropdown && (
        <span aria-hidden className="ml-2 inline-block no-underline">
          ▾
        </span>
      )}
    </>
  );
  if (!item.href) return <span className={className}>{label}</span>;
  if (item.external) {
    return (
      <a
        href={item.href}
        className={className}
        {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} {...(item.newTab ? { target: "_blank" } : {})}>
      {label}
    </Link>
  );
}

/** Underline in the accent colour on hover/focus (old site's menu effect). */
const menuLink =
  "block px-4 py-2.5 decoration-header-accent decoration-2 underline-offset-4 hover:underline focus-visible:underline";

export function MainNavigation({ items }: { items: NavItem[] }) {
  return (
    <>
      <nav aria-label="Hauptnavigation" className="hidden lg:block">
        <ul className="flex flex-wrap items-center">
          {items.map((item) => (
            <li key={item.id} className="group relative">
              <NavLink
                item={item}
                dropdown={item.children.length > 0}
                className={`${menuLink} ${item.children.length ? "pr-2" : ""}`}
              />
              {item.children.length > 0 && (
                <ul className="invisible absolute top-full left-0 z-40 min-w-56 bg-header-accent text-accent-foreground group-focus-within:visible group-hover:visible">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <NavLink
                        item={child}
                        className={`${menuLink} decoration-accent-foreground`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <details className="group ml-auto lg:hidden">
        <summary
          className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md bg-primary text-2xl text-primary-foreground [&::-webkit-details-marker]:hidden"
          aria-label="Menü"
        >
          <span aria-hidden className="group-open:hidden">
            ☰
          </span>
          <span aria-hidden className="hidden group-open:inline">
            ✕
          </span>
        </summary>
        <nav
          aria-label="Hauptnavigation (mobil)"
          className="absolute top-full right-0 left-0 max-h-[calc(100vh-100px)] overflow-y-auto border-t-2 border-header-accent bg-header-2 pb-4"
        >
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id}>
                <NavLink item={item} className={menuLink} />
                {item.children.length > 0 && (
                  <ul className="ml-6 flex flex-col">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <NavLink item={child} className={menuLink} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </details>
    </>
  );
}

export function FooterNavigation({ items }: { items: NavItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Fußzeile">
      <ul className="flex flex-col gap-x-2 sm:flex-row sm:flex-wrap">
        {items.map((item) => (
          <li key={item.id}>
            <NavLink item={item} className={menuLink} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
