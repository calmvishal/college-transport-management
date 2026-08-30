"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "clsx";

const LINKS_BY_ROLE: Record<string, { href: string; label: string }[]> = {
  student: [{ href: "/student", label: "My Transport" }],
  driver: [{ href: "/driver", label: "Attendance" }],
  incharge: [
    { href: "/incharge/dashboard", label: "Daily Dashboard" },
    { href: "/incharge/clubbing", label: "Clubbing" },
    { href: "/incharge/vehicles", label: "Vehicles" },
    { href: "/incharge/students", label: "Students" },
    { href: "/incharge/drivers", label: "Drivers" },
    { href: "/incharge/reports", label: "Reports" },
  ],
};

export default function NavBar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const role = session?.user?.role;
  const links = role ? LINKS_BY_ROLE[role] || [] : [];

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-brand-600">🚌 College Transport</span>
        </div>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "rounded-md px-3 py-2 text-sm font-medium",
                pathname === link.href
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {link.label}
            </Link>
          ))}
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="ml-2 rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Sign out
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-slate-200 px-4 py-2 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={clsx(
                "block rounded-md px-3 py-2 text-sm font-medium",
                pathname === link.href
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {link.label}
            </Link>
          ))}
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
