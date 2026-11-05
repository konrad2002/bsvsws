import type { NavItem } from "@bsv-sws/validation";
import Link from "next/link";

/**
 * Database-managed navigation (spec §9.2). Desktop: hover/focus dropdowns;
 * mobile: a native <details> menu (works without JavaScript).
 */
function NavLink({ item, className }: { item: NavItem; className?: string }) {
  if (!item.href) return <span className={className}>{item.label}</span>;
  if (item.external) {
    return (
      <a
        href={item.href}
        className={className}
        {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} {...(item.newTab ? { target: "_blank" } : {})}>
      {item.label}
    </Link>
  );
}

export function MainNavigation({ items }: { items: NavItem[] }) {
  return (
    <>
      <nav aria-label="Hauptnavigation" className="hidden md:block">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {items.map((item) => (
            <li key={item.id} className="group relative">
              <NavLink item={item} className="block py-2 hover:underline" />
              {item.children.length > 0 && (
                <ul className="invisible absolute left-0 top-full z-20 min-w-56 rounded border bg-white py-1 shadow-sm group-hover:visible group-focus-within:visible">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <NavLink item={child} className="block px-3 py-1.5 hover:bg-neutral-100" />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <details className="md:hidden">
        <summary className="cursor-pointer list-none rounded border px-3 py-1 text-sm">
          Menü
        </summary>
        <nav aria-label="Hauptnavigation (mobil)" className="mt-2">
          <ul className="flex flex-col gap-1 text-sm">
            {items.map((item) => (
              <li key={item.id}>
                <NavLink item={item} className="block py-1 font-medium" />
                {item.children.length > 0 && (
                  <ul className="ml-4 flex flex-col">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <NavLink item={child} className="block py-1" />
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
      <ul className="flex flex-wrap gap-4 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <NavLink item={item} className="hover:underline" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
