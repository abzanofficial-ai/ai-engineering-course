"use client";

// Navigation that is always one tap away: a bottom tab bar on phones and links in the header
// on wider screens. The current section is marked with aria-current.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

type Item = { href: string; label: string; icon: IconName; match: (path: string) => boolean };

function items(course: string): Item[] {
  const learn = `/learn/${course}`;
  return [
    { href: "/home", label: "Home", icon: "courses", match: (p) => p === "/home" },
    {
      href: learn,
      label: "Course",
      icon: "path",
      match: (p) => p === learn || p.startsWith(`${learn}/`),
    },
    { href: "/review", label: "Review", icon: "review", match: (p) => p.startsWith("/review") },
    {
      href: "/progress",
      label: "Progress",
      icon: "chart",
      match: (p) => p.startsWith("/progress"),
    },
    { href: "/notes", label: "Notes", icon: "note", match: (p) => p.startsWith("/notes") },
  ];
}

function NavLinks({ course, className }: { course: string; className: string }) {
  const path = usePathname() ?? "/";
  return (
    <ul className={className}>
      {items(course).map((it) => {
        const current = it.match(path);
        return (
          <li key={it.href}>
            <Link className="nav-link" href={it.href} aria-current={current ? "page" : undefined}>
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** In the header on tablets and computers. */
export function HeaderNav({ course }: { course: string }) {
  if (usePathname() === "/") return null; // the landing page has its own calls to action
  return (
    <nav className="header-nav" aria-label="Main">
      <NavLinks course={course} className="header-nav-list" />
    </nav>
  );
}

/** Fixed to the bottom of the screen on phones. */
export function TabBar({ course }: { course: string }) {
  if (usePathname() === "/") return null;
  return (
    <nav className="tab-bar" aria-label="Main (bottom)">
      <NavLinks course={course} className="tab-bar-list" />
    </nav>
  );
}
