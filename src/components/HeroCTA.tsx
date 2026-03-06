"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function HeroCTA() {
  const { data: session } = useSession();

  if (session) {
    const role = (session.user as any)?.role;
    const dashboardHref =
      role === "GUIDE"
        ? "/dashboard/guide"
        : role === "ADMIN"
          ? "/admin"
          : "/dashboard/seeker";

    return (
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href={dashboardHref}
          className="inline-flex items-center justify-center bg-white text-teal-700 font-semibold px-8 py-3.5 rounded-full hover:bg-teal-50 hover:shadow-lg hover:shadow-white/25 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-700 transition-all duration-300"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/watch"
          className="inline-flex items-center justify-center border-2 border-white/30 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/10 hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-700 transition-all duration-300"
        >
          Watch Stories
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <Link
        href="/auth/register"
        className="inline-flex items-center justify-center bg-white text-teal-700 font-semibold px-8 py-3.5 rounded-full hover:bg-teal-50 hover:shadow-lg hover:shadow-white/25 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-700 transition-all duration-300"
      >
        Get Started Free
      </Link>
      <Link
        href="/watch"
        className="inline-flex items-center justify-center border-2 border-white/30 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/10 hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-700 transition-all duration-300"
      >
        Watch Stories
      </Link>
    </div>
  );
}
