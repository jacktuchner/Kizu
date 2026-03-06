"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function GuideCTA({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const btnBase = "inline-flex items-center justify-center font-semibold transition-all duration-300 disabled:opacity-50";
  const btnClass = variant === "light"
    ? `${btnBase} bg-teal-600 text-white px-4 py-2 rounded-full hover:bg-teal-700 text-sm whitespace-nowrap`
    : `${btnBase} bg-white text-teal-700 px-8 py-3.5 rounded-full hover:bg-teal-50 hover:shadow-lg hover:shadow-white/20`;
  const { data: session } = useSession();

  const role = (session?.user as any)?.role;
  const guideStatus = (session?.user as any)?.guideStatus;
  const isAlreadyGuide = role === "GUIDE" || role === "BOTH" || role === "ADMIN";

  if (isAlreadyGuide && guideStatus === "APPROVED") {
    return (
      <Link href="/dashboard/guide" className={btnClass}>
        Go to Guide Dashboard
      </Link>
    );
  }

  if (role === "ADMIN") {
    return (
      <Link href="/dashboard/guide" className={btnClass}>
        Go to Guide Dashboard
      </Link>
    );
  }

  if (guideStatus === "PENDING_REVIEW") {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className={variant === "light" ? "text-amber-700 font-medium text-sm" : "text-amber-200 font-medium text-sm"}>
          Application under review
        </p>
        <Link href="/guide-application" className={btnClass}>
          View Application Status
        </Link>
      </div>
    );
  }

  if (guideStatus === "REJECTED") {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className={variant === "light" ? "text-red-600 text-sm" : "text-red-200 text-sm"}>
          Application not approved
        </p>
        <Link href="/guide-application" className={btnClass}>
          Reapply as Guide
        </Link>
      </div>
    );
  }

  if (role === "SEEKER") {
    return (
      <Link href="/guide-application" className={btnClass}>
        Become a Guide
      </Link>
    );
  }

  return (
    <Link href="/auth/register?role=guide" className={btnClass}>
      Become a Guide
    </Link>
  );
}
