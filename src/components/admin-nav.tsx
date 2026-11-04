import Link from "next/link";

const ITEMS = [
  { href: "/admin/content", label: "Content" },
  { href: "/admin/commerce", label: "Access and centres" },
  { href: "/admin/flags", label: "Feature flags" },
  { href: "/admin/analytics", label: "Analytics" },
] as const;

/** Links between the platform owner's screens. */
export function AdminNav({ current }: { current: (typeof ITEMS)[number]["href"] }) {
  return (
    <nav aria-label="Admin" className="admin-nav">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.href === current ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
