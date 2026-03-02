"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const userRole = (session?.user as any)?.role;
  const [navCounts, setNavCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (status === "loading") return;
    if (!session || userRole !== "ADMIN") {
      router.push("/");
      return;
    }

    // Fetch counts for nav badges
    async function fetchCounts() {
      try {
        const [appsRes, usersRes, reportsRes] = await Promise.all([
          fetch("/api/admin/applications?status=PENDING_REVIEW&limit=1"),
          fetch("/api/admin/users?limit=1"),
          fetch("/api/reports?status=PENDING"),
        ]);
        const appsData = appsRes.ok ? await appsRes.json() : null;
        const usersData = usersRes.ok ? await usersRes.json() : null;
        const reportsData = reportsRes.ok ? await reportsRes.json() : null;
        setNavCounts({
          applications: appsData?.pagination?.total || 0,
          users: usersData?.pagination?.total || 0,
          reports: reportsData?.reports?.length || 0,
        });
      } catch {
        // Silently fail — counts are just nice-to-have
      }
    }
    fetchCounts();
  }, [session, status, userRole, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!session || userRole !== "ADMIN") {
    return null;
  }

  const navItems = [
    { href: "/admin", label: "Overview", icon: "📊", countKey: "" },
    { href: "/admin/applications", label: "Applications", icon: "📋", countKey: "applications" },
    { href: "/admin/recordings", label: "Recordings", icon: "🎙️", countKey: "" },
    { href: "/admin/users", label: "Users", icon: "👥", countKey: "users" },
    { href: "/admin/reports", label: "Reports", icon: "🚩", countKey: "reports" },
    { href: "/admin/payments", label: "Payments", icon: "💰", countKey: "" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen fixed">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Kizu</p>
          </div>
          <nav className="p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  pathname === item.href
                    ? "bg-teal-50 text-teal-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.countKey && navCounts[item.countKey] != null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    (item.countKey === "applications" || item.countKey === "reports") && navCounts[item.countKey] > 0
                      ? "bg-amber-100 text-amber-700 font-medium"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {navCounts[item.countKey]}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <Link
              href="/dashboard/guide"
              className="text-sm text-gray-500 hover:text-teal-600"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 ml-64 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
