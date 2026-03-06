"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

const tabs = [
  { href: "/dashboard/guide", label: "Overview" },
  { href: "/dashboard/guide/content", label: "Content" },
  { href: "/dashboard/guide/calls", label: "Calls" },
  { href: "/dashboard/guide/profile", label: "Profile" },
  { href: "/dashboard/guide/analytics", label: "Analytics" },
];

export default function GuideDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const role = (session?.user as any)?.role;
  const contributorStatus = (session?.user as any)?.contributorStatus;
  const hasAccess = role === "GUIDE" || role === "BOTH" || role === "ADMIN";
  const isPending = contributorStatus === "PENDING_REVIEW";
  const needsApplication = hasAccess && role !== "ADMIN" && !contributorStatus;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
    if (status === "authenticated" && !hasAccess) router.push("/dashboard/seeker");
  }, [status, hasAccess, router]);

  if (status === "loading" || (status === "authenticated" && !hasAccess)) {
    return <div className="max-w-5xl mx-auto px-4 py-8">Loading...</div>;
  }

  function isActive(href: string) {
    if (href === "/dashboard/guide") {
      return pathname === "/dashboard/guide";
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Guide Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome, {session?.user?.name}</p>
      </div>

      {needsApplication && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="font-medium text-blue-800">Your application is not complete</p>
              <p className="text-sm text-blue-700 mt-0.5">
                You need to complete your guide application before you can create content, record stories, or accept calls.{" "}
                <Link href="/guide-application" className="font-medium underline hover:text-blue-900">
                  Complete your application
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-amber-800">Application Under Review</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Your guide application is being reviewed. You can set up your profile while you wait, but content creation will be available once approved.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-0 min-w-max -mb-px">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive(tab.href)
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}
