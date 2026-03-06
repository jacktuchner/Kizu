"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SeekerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = (session?.user as any)?.role;
  const hasAccess = role === "SEEKER" || role === "BOTH" || role === "ADMIN";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
    if (status === "authenticated" && !hasAccess) router.push("/dashboard/guide");
  }, [status, hasAccess, router]);

  if (status === "loading" || (status === "authenticated" && !hasAccess)) {
    return <div className="max-w-5xl mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Seeker Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome, {session?.user?.name}</p>
      </div>

      {children}
    </div>
  );
}
