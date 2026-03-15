"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, UserCircle, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavBar() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("starkzap_session");
    if (session) {
      try {
        const parsed = JSON.parse(session);
        setIsLoggedIn(Date.now() < parsed.sessionExpiry);
      } catch {
        setIsLoggedIn(false);
      }
    }
  }, [pathname]);

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/explore", label: "Explore", icon: Compass },
    ...(isLoggedIn
      ? [{ href: "/profile", label: "Profile", icon: UserCircle }]
      : [{ href: "/login", label: "Login", icon: LogIn }]),
  ];

  return (
    <>
      {/* Desktop top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 hidden md:block bg-[#1A1A1A]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-warm-yellow transition-colors hover:opacity-80"
          >
            yapper
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all",
                  pathname === item.href
                    ? "bg-warm-yellow text-[#111111]"
                    : "text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A]"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile bottom nav — floating dark pill */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-4 pb-4">
        <div className="flex items-center rounded-full bg-[#111111] px-2 py-2 shadow-2xl shadow-black/60">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-full p-2.5 text-xs font-medium transition-all",
                  isActive
                    ? "bg-warm-yellow text-[#111111] px-4"
                    : "text-[#A0A0A0]"
                )}
              >
                <item.icon className="size-5" />
                {isActive && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
