"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { PROCEDURE_TYPES, AGE_RANGES, GENDERS, ACTIVITY_LEVELS, RECOVERY_GOALS, COMPLICATING_FACTORS, LIFESTYLE_CONTEXTS, CHRONIC_PAIN_CONDITIONS, CHRONIC_PAIN_GOALS, CHRONIC_PAIN_COMPLICATING_FACTORS, isChronicPainCondition, getAllConditions } from "@/lib/constants";
import { getTimeSinceSurgery, getTimeSinceSurgeryLabel, getTimeSinceDiagnosisLabel, getCurrentRecoveryWeek } from "@/lib/surgeryDate";
import RecoveryJournal from "@/components/seeker/RecoveryJournal";
import ProfileWizard from "@/components/ProfileWizard";
import VideoCall from "@/components/VideoCall";
import GuideCTA from "@/components/GuideCTA";
import PurchaseHistory from "@/components/PurchaseHistory";
import CallReviewForm from "@/components/CallReviewForm";
import { parseDate } from "@/lib/dates";

interface ProcedureProfile {
  procedureDetails?: string;
  surgeryDate?: string;
  timeSinceSurgery?: string;
  recoveryGoals?: string[];
  complicatingFactors?: string[];
}

// Normalize procedureProfiles value: legacy object -> array
function getInstances(procedureProfiles: Record<string, any>, proc: string, legacyProfile?: any): ProcedureProfile[] {
  const val = procedureProfiles[proc];
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object" && Object.keys(val).length > 0) return [val];
  if (legacyProfile && proc === legacyProfile.procedureType) {
    return [{
      procedureDetails: legacyProfile.procedureDetails || "",
      surgeryDate: legacyProfile.surgeryDate || "",
      timeSinceSurgery: legacyProfile.timeSinceSurgery || "",
      recoveryGoals: legacyProfile.recoveryGoals || [],
      complicatingFactors: legacyProfile.complicatingFactors || [],
    }];
  }
  return [{ procedureDetails: "", surgeryDate: "", timeSinceSurgery: "", recoveryGoals: [], complicatingFactors: [] }];
}

function enrichInstance(inst: ProcedureProfile): ProcedureProfile {
  return {
    ...inst,
    timeSinceSurgery: inst.surgeryDate
      ? getTimeSinceSurgery(inst.surgeryDate) || inst.timeSinceSurgery
      : inst.timeSinceSurgery,
  };
}

export default function SeekerDashboard() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [groupSessions, setGroupSessions] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showAddProcedure, setShowAddProcedure] = useState(false);
  const [editing, setEditing] = useState<{ proc: string; idx: number } | null>(null);
  const [editingShared, setEditingShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [procSaved, setProcSaved] = useState(false);
  const [sharedSaved, setSharedSaved] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [switchingProcedure, setSwitchingProcedure] = useState(false);

  // Reviews state
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [reviewingCallId, setReviewingCallId] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  // Shared profile fields
  const [sharedForm, setSharedForm] = useState({
    ageRange: "",
    gender: "",
    activityLevel: "RECREATIONAL",
    lifestyleContext: [] as string[],
  });

  // Per-procedure form
  const [procForm, setProcForm] = useState<ProcedureProfile>({
    procedureDetails: "",
    surgeryDate: "",
    timeSinceSurgery: "",
    recoveryGoals: [],
    complicatingFactors: [],
  });

  const [newProcedure, setNewProcedure] = useState("");


  useEffect(() => {
    if (!session?.user) return;
    async function load() {
      try {
        const userId = (session?.user as any)?.id;
        const [profileRes, callsRes, reviewsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/calls"),
          fetch(`/api/reviews?authorId=${userId}`),
        ]);
        if (profileRes.ok) {
          const p = await profileRes.json();
          if (p) {
            setProfile(p);
            setSharedForm({
              ageRange: p.ageRange || "",
              gender: p.gender || "",
              activityLevel: p.activityLevel || "RECREATIONAL",
              lifestyleContext: p.lifestyleContext || [],
            });
          } else {
            setShowWizard(true);
          }
        }
        if (callsRes.ok) setCalls(await callsRes.json());
        // Fetch group sessions
        try {
          const gsRes = await fetch("/api/group-sessions?participating=true");
          if (gsRes.ok) setGroupSessions(await gsRes.json());
        } catch {}
        if (reviewsRes.ok) {
          setMyReviews(await reviewsRes.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  // Get procedures list (unique types)
  const procedures: string[] = profile?.procedureTypes?.length > 0
    ? profile.procedureTypes
    : (profile?.procedureType ? [profile.procedureType] : []);

  const activeProcedure = profile?.activeProcedureType || profile?.procedureType || procedures[0];

  // Get procedure profiles
  const procedureProfiles: Record<string, any> = profile?.procedureProfiles || {};

  // Helper to get procedure-specific data for a given instance
  function getProcedureData(proc: string, index: number): ProcedureProfile {
    const instances = getInstances(procedureProfiles, proc, profile);
    return enrichInstance(instances[index] || instances[0] || {});
  }

  async function switchActiveProcedure(proc: string) {
    if (proc === activeProcedure) return;
    setSwitchingProcedure(true);
    try {
      const res = await fetch("/api/profile/active-procedure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureType: proc }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSwitchingProcedure(false);
    }
  }

  async function addProcedure() {
    if (!newProcedure || procedures.includes(newProcedure)) return;
    setSaving(true);
    try {
      const updatedProcedures = [...procedures, newProcedure];
      const updatedProfiles = {
        ...procedureProfiles,
        [newProcedure]: [{ procedureDetails: "", surgeryDate: "", timeSinceSurgery: "", recoveryGoals: [], complicatingFactors: [] }],
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sharedForm,
          procedureTypes: updatedProcedures,
          procedureProfiles: updatedProfiles,
          activeProcedureType: newProcedure,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setNewProcedure("");
        setShowAddProcedure(false);
        startEditingProcedure(newProcedure, 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function addInstance(proc: string) {
    setSaving(true);
    try {
      const instances = [...getInstances(procedureProfiles, proc, profile)];
      instances.push({ procedureDetails: "", surgeryDate: "", timeSinceSurgery: "", recoveryGoals: [], complicatingFactors: [] });
      const updatedProfiles = { ...procedureProfiles, [proc]: instances };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sharedForm,
          procedureTypes: procedures,
          procedureProfiles: updatedProfiles,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        startEditingProcedure(proc, instances.length - 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function removeInstance(proc: string, idx: number) {
    const instances = getInstances(procedureProfiles, proc, profile);
    if (instances.length <= 1) {
      return removeProcedure(proc);
    }
    const label = instances[idx].procedureDetails || (isChronicPainCondition(proc) ? `entry #${idx + 1}` : `surgery #${idx + 1}`);
    if (!confirm(`Remove "${label}" from ${proc}?`)) return;

    setSaving(true);
    try {
      const updated = instances.filter((_: ProcedureProfile, i: number) => i !== idx);
      const updatedProfiles = { ...procedureProfiles, [proc]: updated };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sharedForm,
          procedureTypes: procedures,
          procedureProfiles: updatedProfiles,
        }),
      });
      if (res.ok) {
        setProfile(await res.json());
        if (editing?.proc === proc && editing.idx === idx) setEditing(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function removeProcedure(proc: string) {
    if (procedures.length <= 1) return;
    if (!confirm(`Remove ${proc} and all its entries from your profile?`)) return;

    setSaving(true);
    try {
      const updatedProcedures = procedures.filter((p: string) => p !== proc);
      const updatedProfiles = { ...procedureProfiles };
      delete updatedProfiles[proc];
      const newActive = proc === activeProcedure ? updatedProcedures[0] : activeProcedure;

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sharedForm,
          procedureTypes: updatedProcedures,
          procedureType: updatedProcedures[0],
          procedureProfiles: updatedProfiles,
          activeProcedureType: newActive,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        if (editing?.proc === proc) setEditing(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function startEditingProcedure(proc: string, idx: number) {
    const instances = getInstances(procedureProfiles, proc, profile);
    const data = enrichInstance(instances[idx] || {});
    setProcForm({
      procedureDetails: data.procedureDetails || "",
      surgeryDate: data.surgeryDate || "",
      timeSinceSurgery: data.timeSinceSurgery || "",
      recoveryGoals: data.recoveryGoals || [],
      complicatingFactors: data.complicatingFactors || [],
    });
    setEditing({ proc, idx });
  }

  async function saveProcedureData(proc: string, idx: number) {
    setSaving(true);
    try {
      const computedTimeSince = procForm.surgeryDate
        ? getTimeSinceSurgery(procForm.surgeryDate) || procForm.timeSinceSurgery
        : procForm.timeSinceSurgery;

      const instanceData = {
        ...procForm,
        timeSinceSurgery: computedTimeSince,
      };

      const instances = [...getInstances(procedureProfiles, proc, profile)];
      instances[idx] = instanceData;

      const updatedProfiles = {
        ...procedureProfiles,
        [proc]: instances,
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sharedForm,
          procedureTypes: procedures,
          procedureProfiles: updatedProfiles,
          ...(proc === profile?.procedureType && idx === 0 && {
            procedureDetails: instanceData.procedureDetails,
            surgeryDate: instanceData.surgeryDate,
            timeSinceSurgery: computedTimeSince,
            recoveryGoals: instanceData.recoveryGoals,
            complicatingFactors: instanceData.complicatingFactors,
          }),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setEditing(null);
        setProcSaved(true);
        setTimeout(() => setProcSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function saveSharedProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sharedForm,
          procedureTypes: procedures,
          procedureProfiles: procedureProfiles,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setEditingShared(false);
        setSharedSaved(true);
        setTimeout(() => setSharedSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleWizardComplete(data: any) {
    setWizardError(null);
    try {
      const initialProfiles = {
        [data.procedureType]: {
          procedureDetails: data.procedureDetails || "",
          timeSinceSurgery: data.timeSinceSurgery || "",
          recoveryGoals: data.recoveryGoals || [],
          complicatingFactors: data.complicatingFactors || [],
        },
      };

      const res = await fetch("/api/profile", {
        method: profile ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          conditionCategory: data.conditionCategory || "SURGERY",
          procedureTypes: [data.procedureType],
          activeProcedureType: data.procedureType,
          procedureProfiles: initialProfiles,
        }),
      });
      if (res.ok) {
        const savedProfile = await res.json();
        setProfile(savedProfile);
        setSharedForm({
          ageRange: data.ageRange,
          gender: data.gender || "",
          activityLevel: data.activityLevel,
          lifestyleContext: data.lifestyleContext || [],
        });
        setShowWizard(false);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setWizardError(errorData.error || "Failed to save profile. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setWizardError("Network error. Please check your connection and try again.");
    }
  }

  function toggleProcFormGoal(value: string) {
    setProcForm((prev) => ({
      ...prev,
      recoveryGoals: prev.recoveryGoals?.includes(value)
        ? prev.recoveryGoals.filter((v) => v !== value)
        : [...(prev.recoveryGoals || []), value],
    }));
  }

  function toggleProcFormFactor(value: string) {
    setProcForm((prev) => ({
      ...prev,
      complicatingFactors: prev.complicatingFactors?.includes(value)
        ? prev.complicatingFactors.filter((v) => v !== value)
        : [...(prev.complicatingFactors || []), value],
    }));
  }

  function toggleSharedLifestyle(value: string) {
    setSharedForm((prev) => ({
      ...prev,
      lifestyleContext: prev.lifestyleContext.includes(value)
        ? prev.lifestyleContext.filter((v) => v !== value)
        : [...prev.lifestyleContext, value],
    }));
  }

  const [cancellingCallId, setCancellingCallId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function getHoursUntilCall(scheduledAt: string): number {
    return (new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
  }

  async function cancelCall(callId: string) {
    setCancelError(null);
    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCalls((prev) => prev.map((c) => (c.id === callId ? updated : c)));
        setCancellingCallId(null);
      } else {
        const data = await res.json();
        setCancelError(data.error || "Failed to cancel call");
      }
    } catch (err) {
      console.error(err);
      setCancelError("Something went wrong");
    }
  }

  // Helper: check if a call has been reviewed
  function callHasReview(callId: string) {
    return myReviews.some((r: any) => r.callId === callId);
  }

  async function deleteReview(reviewId: string) {
    if (!confirm("Are you sure you want to delete this review?")) return;
    setDeletingReviewId(reviewId);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" });
      if (res.ok) {
        setMyReviews((prev) => prev.filter((r: any) => r.id !== reviewId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingReviewId(null);
    }
  }

  // Pending reviews: completed calls without a review (limit 3)
  const pendingCallReviews = calls
    .filter((c: any) => c.status === "COMPLETED" && !callHasReview(c.id))
    .slice(0, 3);

  if (status === "loading" || loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (showWizard) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Welcome to Kizu</h2>
          <p className="text-gray-600 mt-1">Let&apos;s set up your profile to find the best matches.</p>
        </div>
        <ProfileWizard
          initialData={profile ? {
            conditionCategory: profile.conditionCategory,
            procedureType: profile.procedureType,
            procedureDetails: profile.procedureDetails,
            ageRange: profile.ageRange,
            activityLevel: profile.activityLevel,
            recoveryGoals: profile.recoveryGoals,
            complicatingFactors: profile.complicatingFactors,
            lifestyleContext: profile.lifestyleContext,
          } : undefined}
          onComplete={handleWizardComplete}
          onCancel={profile ? () => setShowWizard(false) : undefined}
          error={wizardError}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Become a Guide CTA */}
      {(session?.user as any)?.role === "SEEKER" && (
        <section className="bg-gradient-to-r from-cyan-50 to-teal-50 rounded-xl border border-teal-200 p-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">Been through it?</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Sharing your story can be just as meaningful for you as it is for others. Many guides say it feels almost therapeutic. Become a guide to share your experience and help seekers.
              </p>
            </div>
            <div className="self-start">
              <GuideCTA variant="light" />
            </div>
          </div>
        </section>
      )}

      {/* Community Forum */}
      <section className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200 p-5 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Community Forum</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              Connect with others on similar recovery journeys. Ask questions, share tips, and support each other.
            </p>
          </div>
          <Link
            href="/community"
            className="self-start bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium whitespace-nowrap"
          >
            Visit Community
          </Link>
        </div>
      </section>

      {/* Pending Reviews Banner */}
      {pendingCallReviews.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
          <h3 className="font-semibold text-amber-900 mb-2">Leave a Review</h3>
          <p className="text-sm text-amber-700 mb-3">
            You have {pendingCallReviews.length} completed {pendingCallReviews.length === 1 ? "call" : "calls"} waiting for your feedback.
          </p>
          <div className="space-y-2">
            {pendingCallReviews.map((call: any) => (
              <div key={call.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{call.guide?.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(call.scheduledAt).toLocaleDateString()} &middot; {call.durationMinutes} min
                  </p>
                </div>
                <button
                  onClick={() => setReviewingCallId(call.id)}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Leave a Review
                </button>
              </div>
            ))}
          </div>
          {/* Inline review form for pending review */}
          {pendingCallReviews.some((c: any) => c.id === reviewingCallId) && (
            <div className="mt-3">
              {(() => {
                const call = pendingCallReviews.find((c: any) => c.id === reviewingCallId);
                if (!call) return null;
                return (
                  <CallReviewForm
                    callId={call.id}
                    guideId={call.guideId || call.guide?.id}
                    guideName={call.guide?.name || "Guide"}
                    onReviewSubmitted={(review) => {
                      setMyReviews((prev) => [review, ...prev]);
                      setReviewingCallId(null);
                    }}
                    onCancel={() => setReviewingCallId(null)}
                  />
                );
              })()}
            </div>
          )}
        </section>
      )}

      {/* My Procedures Section */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">My Health Profile</h2>
            <p className="text-sm text-gray-500 mt-1">
              Your surgeries and conditions, each with their own goals and details
            </p>
          </div>
          <div className="flex items-center gap-3">
            {procSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            <button
              onClick={() => setShowAddProcedure(true)}
              className="text-sm bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-100 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
        </div>

        {/* Procedure Cards */}
        <div className="space-y-4">
          {procedures.map((proc: string) => {
            const instances = getInstances(procedureProfiles, proc, profile);
            const isActive = proc === activeProcedure;

            return (
              <div
                key={proc}
                className={`rounded-xl border-2 transition-all ${
                  isActive ? "border-teal-500 bg-teal-50/50" : "border-gray-200 bg-white"
                }`}
              >
                {/* Procedure Type Header */}
                <div
                  onClick={() => switchActiveProcedure(proc)}
                  className={`p-4 flex items-center justify-between cursor-pointer ${switchingProcedure ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive ? "bg-teal-600" : "bg-gray-100"
                    }`}>
                      <svg className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${isActive ? "text-teal-900" : "text-gray-900"}`}>
                          {proc}
                        </h3>
                        {isActive && (
                          <span className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {isChronicPainCondition(proc)
                          ? null
                          : `${instances.length} ${instances.length === 1 ? "surgery" : "surgeries"}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {procedures.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProcedure(proc);
                        }}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Instances */}
                <div className="border-t border-gray-100">
                  {instances.map((inst, idx) => {
                    const data = enrichInstance(inst);
                    const isEditing = editing?.proc === proc && editing.idx === idx;

                    return (
                      <div key={idx} className={`${idx > 0 ? "border-t border-gray-100" : ""}`}>
                        {!isEditing && (
                          <div className="px-4 py-3 flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm text-gray-800">
                                {data.procedureDetails || <span className="text-gray-400 italic">No details yet</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                {data.surgeryDate
                                  ? (isChronicPainCondition(proc) ? getTimeSinceDiagnosisLabel(data.surgeryDate) : getTimeSinceSurgeryLabel(data.surgeryDate))
                                  : (data.timeSinceSurgery || (isChronicPainCondition(proc) ? "Diagnosis date not set" : "Surgery date not set"))}
                                {data.recoveryGoals?.length ? ` • ${data.recoveryGoals.length} goals` : ""}
                              </p>
                              {((data.recoveryGoals?.length ?? 0) > 0 || (data.complicatingFactors?.length ?? 0) > 0) && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {data.recoveryGoals?.map((g: string) => (
                                    <span key={g} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{g}</span>
                                  ))}
                                  {data.complicatingFactors?.map((f: string) => (
                                    <span key={f} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <button
                                onClick={() => startEditingProcedure(proc, idx)}
                                className="text-sm text-teal-600 hover:text-teal-700 font-medium px-2 py-1"
                              >
                                Edit
                              </button>
                              {instances.length > 1 && (
                                <button
                                  onClick={() => removeInstance(proc, idx)}
                                  className="text-gray-400 hover:text-red-500 p-1"
                                  title={isChronicPainCondition(proc) ? "Remove this entry" : "Remove this surgery"}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {isEditing && (
                          <div className="p-4 space-y-4 bg-gray-50/50">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{isChronicPainCondition(proc) ? "Condition Details" : "Procedure Details"}</label>
                                <input
                                  type="text"
                                  value={procForm.procedureDetails || ""}
                                  onChange={(e) => setProcForm((f) => ({ ...f, procedureDetails: e.target.value }))}
                                  placeholder={isChronicPainCondition(proc) ? "e.g., Moderate severity, widespread" : "e.g., Patellar tendon graft"}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{isChronicPainCondition(proc) ? "Diagnosis Date" : "Surgery Date"}</label>
                                <input
                                  type="date"
                                  value={procForm.surgeryDate || ""}
                                  onChange={(e) => setProcForm((f) => ({ ...f, surgeryDate: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                                {procForm.surgeryDate && (
                                  <p className="mt-1 text-sm text-teal-600 font-medium">
                                    {isChronicPainCondition(proc) ? getTimeSinceDiagnosisLabel(procForm.surgeryDate) : getTimeSinceSurgeryLabel(procForm.surgeryDate)}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">{isChronicPainCondition(proc) ? "Goals" : "Recovery Goals"} for {proc}</label>
                              <div className="flex flex-wrap gap-2">
                                {(isChronicPainCondition(proc) ? CHRONIC_PAIN_GOALS : RECOVERY_GOALS).map((g) => (
                                  <button
                                    key={g}
                                    type="button"
                                    onClick={() => toggleProcFormGoal(g)}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                      procForm.recoveryGoals?.includes(g)
                                        ? "bg-teal-50 border-teal-300 text-teal-700"
                                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                                    }`}
                                  >
                                    {g}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">{isChronicPainCondition(proc) ? "Complicating Factors" : "Complicating Factors"} for {proc}</label>
                              <div className="flex flex-wrap gap-2">
                                {(isChronicPainCondition(proc) ? CHRONIC_PAIN_COMPLICATING_FACTORS : COMPLICATING_FACTORS).map((f) => (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={() => toggleProcFormFactor(f)}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                      procForm.complicatingFactors?.includes(f)
                                        ? "bg-orange-50 border-orange-300 text-orange-700"
                                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                                    }`}
                                  >
                                    {f}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                              <button
                                onClick={() => saveProcedureData(proc, idx)}
                                disabled={saving}
                                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                              >
                                {saving ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add another instance (only for surgeries — chronic pain conditions can't be duplicated) */}
                {!isChronicPainCondition(proc) && (
                  <div className="border-t border-gray-100 px-4 py-2">
                    <button
                      onClick={() => addInstance(proc)}
                      disabled={saving}
                      className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add another {proc}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Procedure */}
        {showAddProcedure && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="font-medium text-gray-900 mb-3">Add to Your Health Profile</h3>
            <div className="flex gap-3">
              <select
                value={newProcedure}
                onChange={(e) => setNewProcedure(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Choose a surgery or condition...</option>
                <optgroup label="Surgeries">
                  {getAllConditions().filter((c) => c.category === "SURGERY" && !procedures.includes(c.value)).map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Autoimmune">
                  {getAllConditions().filter((c) => c.category === "CHRONIC_PAIN" && !procedures.includes(c.value)).map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </optgroup>
              </select>
              <button
                onClick={addProcedure}
                disabled={!newProcedure || saving}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? "Adding..." : "Add"}
              </button>
              <button
                onClick={() => {
                  setShowAddProcedure(false);
                  setNewProcedure("");
                }}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Shared Profile Section */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">About You</h2>
            <p className="text-sm text-gray-500">These apply across your entire health profile</p>
          </div>
          <div className="flex items-center gap-3">
            {sharedSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            {!editingShared && (
              <button
                onClick={() => setEditingShared(true)}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {editingShared ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age Range</label>
                <select
                  value={sharedForm.ageRange}
                  onChange={(e) => setSharedForm((f) => ({ ...f, ageRange: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {AGE_RANGES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={sharedForm.gender}
                  onChange={(e) => setSharedForm((f) => ({ ...f, gender: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activity Level</label>
                <select
                  value={sharedForm.activityLevel}
                  onChange={(e) => setSharedForm((f) => ({ ...f, activityLevel: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {ACTIVITY_LEVELS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lifestyle Context</label>
              <div className="flex flex-wrap gap-2">
                {LIFESTYLE_CONTEXTS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleSharedLifestyle(l)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      sharedForm.lifestyleContext.includes(l)
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveSharedProfile}
                disabled={saving || !sharedForm.ageRange}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingShared(false);
                  setSharedForm({
                    ageRange: profile?.ageRange || "",
                    gender: profile?.gender || "",
                    activityLevel: profile?.activityLevel || "RECREATIONAL",
                    lifestyleContext: profile?.lifestyleContext || [],
                  });
                }}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Age Range</p>
                <p className="font-medium">{profile?.ageRange || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gender</p>
                <p className="font-medium">{GENDERS.find((g) => g.value === profile?.gender)?.label || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Activity Level</p>
                <p className="font-medium">
                  {profile?.activityLevel?.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase()) || "Not set"}
                </p>
              </div>
            </div>
            {profile?.lifestyleContext?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Lifestyle Context</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.lifestyleContext.map((l: string) => (
                    <span key={l} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <PurchaseHistory role="seeker" />

      {/* Recovery Journal */}
      {activeProcedure && (
        <section className="mb-8">
          <RecoveryJournal
            procedureType={activeProcedure}
            surgeryDate={getProcedureData(activeProcedure, 0).surgeryDate || null}
            currentWeek={getCurrentRecoveryWeek(getProcedureData(activeProcedure, 0).surgeryDate || null) ?? undefined}
            conditionCategory={isChronicPainCondition(activeProcedure) ? "CHRONIC_PAIN" : "SURGERY"}
            procedures={procedures.map((proc) => ({
              procedureType: proc,
              surgeryDate: getProcedureData(proc, 0).surgeryDate || null,
              conditionCategory: isChronicPainCondition(proc) ? "CHRONIC_PAIN" : "SURGERY",
            }))}
          />
        </section>
      )}

      {/* My Group Sessions */}
      {groupSessions.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">My Group Sessions</h2>
            <Link
              href="/group-sessions"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Browse More
            </Link>
          </div>
          <div className="space-y-3">
            {groupSessions.map((gs: any) => {
              const isUpcoming = (gs.status === "SCHEDULED" || gs.status === "CONFIRMED") && parseDate(gs.scheduledAt) > new Date();
              const canJoin = gs.status === "CONFIRMED" && gs.videoRoomUrl && isUpcoming;

              return (
                <div key={gs.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-gray-50">
                    <div>
                      <Link href={`/group-sessions/${gs.id}`} className="font-medium text-gray-900 hover:text-teal-600">
                        {gs.title}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {parseDate(gs.scheduledAt).toLocaleDateString()} at{" "}
                        {parseDate(gs.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" "}&middot; {gs.durationMinutes} min
                        {" "}&middot; {gs.participantCount}/{gs.maxCapacity} participants
                      </p>
                      <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {gs.procedureType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUpcoming && (gs.status === "SCHEDULED" || gs.status === "CONFIRMED") && (
                        <button
                          onClick={async () => {
                            if (!confirm("Are you sure you want to cancel your registration?")) return;
                            try {
                              const res = await fetch(`/api/group-sessions/${gs.id}/cancel`, { method: "POST" });
                              if (res.ok) {
                                setGroupSessions((prev) => prev.filter((s: any) => s.id !== gs.id));
                              } else {
                                const data = await res.json();
                                alert(data.error || "Failed to cancel");
                              }
                            } catch {
                              alert("Failed to cancel");
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      )}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        gs.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                        gs.status === "SCHEDULED" ? "bg-yellow-100 text-yellow-700" :
                        gs.status === "COMPLETED" ? "bg-gray-100 text-gray-600" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {gs.status}
                      </span>
                    </div>
                  </div>
                  {canJoin && (
                    <div className="p-4 border-t border-gray-200">
                      <VideoCall
                        roomUrl={gs.videoRoomUrl}
                        callId={gs.id}
                        scheduledAt={gs.scheduledAt}
                        durationMinutes={gs.durationMinutes}
                        type="group-session"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Upcoming Calls */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Your Calls</h2>
        {cancelError && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4">{cancelError}</div>
        )}
        {calls.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No calls booked yet.</p>
            <Link href="/guides" className="text-teal-600 hover:text-teal-700 font-medium text-sm">
              Find a guide to book a call
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {calls.map((call: any) => {
              const isUpcoming = call.status === "CONFIRMED" && parseDate(call.scheduledAt) > new Date(Date.now() - call.durationMinutes * 60 * 1000);
              const canJoinCall = isUpcoming && call.videoRoomUrl;
              const hoursUntil = getHoursUntilCall(call.scheduledAt);
              const isLateCancel = hoursUntil < 24;
              const showCancelConfirm = cancellingCallId === call.id;

              return (
                <div key={call.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-gray-50">
                    <div>
                      <p className="font-medium">{call.guide?.name}</p>
                      <p className="text-sm text-gray-500">
                        {parseDate(call.scheduledAt).toLocaleDateString()} at{" "}
                        {parseDate(call.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" "}&middot; {call.durationMinutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.status === "CONFIRMED" && !showCancelConfirm && (
                        <button
                          onClick={() => setCancellingCallId(call.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      )}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        call.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                        call.status === "COMPLETED" ? "bg-gray-100 text-gray-600" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {call.status}
                      </span>
                    </div>
                  </div>

                  {/* Cancel confirmation with 24hr policy warning */}
                  {showCancelConfirm && (
                    <div className={`p-4 border-t ${isLateCancel ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                      <div className="flex items-start gap-3">
                        <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isLateCancel ? "text-amber-500" : "text-red-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div className="flex-1">
                          {isLateCancel ? (
                            <>
                              <p className="text-sm font-medium text-amber-800">Late cancellation - no refund</p>
                              <p className="text-xs text-amber-600 mt-1">This call is less than 24 hours away. You will not receive a refund if you cancel now.</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-red-800">Cancel this call?</p>
                              <p className="text-xs text-red-600 mt-1">You will receive a full refund.</p>
                            </>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            <button onClick={() => cancelCall(call.id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium">
                              Yes, Cancel Call
                            </button>
                            <button onClick={() => setCancellingCallId(null)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 font-medium">
                              Keep Call
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Video Call Section for confirmed calls */}
                  {canJoinCall && (
                    <div className="p-4 border-t border-gray-200">
                      <VideoCall
                        roomUrl={call.videoRoomUrl}
                        callId={call.id}
                        scheduledAt={call.scheduledAt}
                        durationMinutes={call.durationMinutes}
                      />
                    </div>
                  )}

                  {/* Call Review prompt for completed calls */}
                  {call.status === "COMPLETED" && !callHasReview(call.id) && reviewingCallId !== call.id && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-teal-50/50">
                      <button
                        onClick={() => setReviewingCallId(call.id)}
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Leave a Review
                      </button>
                    </div>
                  )}
                  {call.status === "COMPLETED" && callHasReview(call.id) && (
                    <div className="px-4 py-2 border-t border-gray-100">
                      <span className="text-xs text-green-600 font-medium">Reviewed</span>
                    </div>
                  )}
                  {reviewingCallId === call.id && (
                    <div className="p-4 border-t border-gray-200">
                      <CallReviewForm
                        callId={call.id}
                        guideId={call.guideId || call.guide?.id}
                        guideName={call.guide?.name || "Guide"}
                        onReviewSubmitted={(review) => {
                          setMyReviews((prev) => [review, ...prev]);
                          setReviewingCallId(null);
                        }}
                        onCancel={() => setReviewingCallId(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* My Reviews Section */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">My Reviews ({myReviews.length})</h2>
        {myReviews.length === 0 ? (
          <p className="text-gray-400 text-sm">You haven&apos;t left any reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {myReviews.map((review: any) => (
              <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{review.subject?.name || "Guide"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      review.callId ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    }`}>
                      {review.callId ? "Call Review" : "Recording Review"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingReviewId(editingReviewId === review.id ? null : review.id)}
                      className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      {editingReviewId === review.id ? "Cancel" : "Edit"}
                    </button>
                    <button
                      onClick={() => deleteReview(review.id)}
                      disabled={deletingReviewId === review.id}
                      className="text-sm text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
                    >
                      {deletingReviewId === review.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>

                {editingReviewId === review.id ? (
                  <CallReviewForm
                    callId={review.callId}
                    recordingId={review.recordingId}
                    guideId={review.subjectId}
                    guideName={review.subject?.name || "Guide"}
                    editMode
                    existingReview={review}
                    onReviewSubmitted={(updated) => {
                      setMyReviews((prev) => prev.map((r: any) => r.id === updated.id ? { ...r, ...updated } : r));
                      setEditingReviewId(null);
                    }}
                    onCancel={() => setEditingReviewId(null)}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-yellow-500 text-sm">
                        {"\u2605".repeat(review.rating)}{"\u2606".repeat(5 - review.rating)}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
