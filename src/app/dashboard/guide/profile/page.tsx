"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import ProceduresSection from "@/components/guide/ProceduresSection";
import SharedProfileSection from "@/components/guide/SharedProfileSection";
import BioIntroVideoSection from "@/components/guide/BioIntroVideoSection";


export default function GuideProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [sharedForm, setSharedForm] = useState({
    ageRange: "",
    gender: "",
    activityLevel: "RECREATIONAL",
    hourlyRate: 50,
    isAvailableForCalls: false,
  });
  const [bio, setBio] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
  const [introVideoDuration, setIntroVideoDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    async function load() {
      try {
        const [profileRes, settingsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/user/settings"),
        ]);
        if (profileRes.ok) {
          const p = await profileRes.json();
          if (p) {
            setProfile(p);
            setSharedForm({
              ageRange: p.ageRange || "",
              gender: p.gender || "",
              activityLevel: p.activityLevel || "RECREATIONAL",
              hourlyRate: p.hourlyRate || 50,
              isAvailableForCalls: p.isAvailableForCalls || false,
            });
            setIntroVideoUrl(p.introVideoUrl || null);
            setIntroVideoDuration(p.introVideoDuration || null);
          }
        }
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          setBio(settings.bio || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const userId = (session?.user as any)?.id;

  return (
    <>
      {userId && (
        <div className="mb-6 flex justify-end">
          <Link
            href={`/guides/${userId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 border border-teal-200 rounded-lg px-4 py-2 hover:bg-teal-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Public Profile
          </Link>
        </div>
      )}

      <ProceduresSection
        profile={profile}
        sharedForm={sharedForm}
        onProfileUpdate={(updated) => setProfile(updated)}
      />

      <SharedProfileSection
        profile={profile}
        sharedForm={sharedForm}
        onSharedFormChange={setSharedForm}
        onProfileUpdate={(updated) => setProfile(updated)}
      />

      <BioIntroVideoSection
        profile={profile}
        sharedForm={sharedForm}
        initialBio={bio}
        initialIntroVideoUrl={introVideoUrl}
        initialIntroVideoDuration={introVideoDuration}
        onProfileUpdate={(updated) => setProfile(updated)}
      />
    </>
  );
}
