"use client";

import { useState, useCallback, useEffect } from "react";
import VoiceRecorder from "./VoiceRecorder";
import VideoRecorder from "./VideoRecorder";
import ThumbnailSelector from "./ThumbnailSelector";
import FaqPromptSelector from "./FaqPromptSelector";
import { getTimeSinceSurgery, getTimeSinceSurgeryLabel, getTimeSinceDiagnosisLabel } from "@/lib/surgeryDate";
import { isChronicPainCondition, getRecordingCategoriesForCondition } from "@/lib/constants";

interface FaqPrompt {
  id: string;
  question: string;
  category: string;
}

interface RecordingFormProps {
  onSuccess: (recording: Record<string, unknown>) => void;
  onCancel: () => void;
}

type Step = "select-prompt" | "record" | "choose-thumbnail" | "details" | "uploading";

export default function RecordingForm({ onSuccess, onCancel }: RecordingFormProps) {
  const [step, setStep] = useState<Step>("select-prompt");
  const [selectedPrompt, setSelectedPrompt] = useState<FaqPrompt | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("WEEKLY_TIMELINE");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaMode, setMediaMode] = useState<"video" | "audio">("video");
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);

  // For guides with multiple procedures
  const [procedureTypes, setProcedureTypes] = useState<string[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState<string>("");
  const [procedureProfiles, setProcedureProfiles] = useState<Record<string, any>>({});
  const [timeSinceSurgery, setTimeSinceSurgery] = useState<string>("");
  const [surgeryDate, setSurgeryDate] = useState<string>("");
  const [conditionCategory, setConditionCategory] = useState<string>("SURGERY");

  const TIME_SINCE_OPTIONS = [
    "Less than 1 month",
    "1-3 months",
    "3-6 months",
    "6-12 months",
    "1-2 years",
    "2-3 years",
    "3-5 years",
    "5+ years",
  ];

  const [form, setForm] = useState({
    title: "",
    description: "",
  });

  const isVideo = mediaMode === "video";
  const totalSteps = isVideo ? 4 : 3;

  const getStepNumber = (s: Step): number => {
    switch (s) {
      case "select-prompt": return 1;
      case "record": return 2;
      case "choose-thumbnail": return 3;
      case "details": return isVideo ? 4 : 3;
      case "uploading": return isVideo ? 4 : 3;
      default: return 1;
    }
  };

  const currentStepNumber = getStepNumber(step);

  // Fetch guide's procedures on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const profile = await res.json();
          const procedures = profile?.procedureTypes?.length > 0
            ? profile.procedureTypes
            : profile?.procedureType
              ? [profile.procedureType]
              : [];
          setProcedureTypes(procedures);
          setProcedureProfiles(profile?.procedureProfiles || {});
          setConditionCategory(profile?.conditionCategory || "SURGERY");

          if (procedures.length > 0) {
            const firstProc = procedures[0];
            setSelectedProcedure(firstProc);

            // Auto-set surgery date from profile
            const procProfile = profile?.procedureProfiles?.[firstProc];
            if (procProfile?.surgeryDate) {
              setSurgeryDate(procProfile.surgeryDate);
              setTimeSinceSurgery(getTimeSinceSurgery(procProfile.surgeryDate) || "");
            } else if (profile?.surgeryDate) {
              setSurgeryDate(profile.surgeryDate);
              setTimeSinceSurgery(getTimeSinceSurgery(profile.surgeryDate) || "");
            }
          }
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    }
    loadProfile();
  }, []);

  const handleProcedureChange = useCallback((newProc: string) => {
    setSelectedProcedure(newProc);
    // Update surgery date from procedure profile
    const procProfile = procedureProfiles[newProc];
    if (procProfile?.surgeryDate) {
      setSurgeryDate(procProfile.surgeryDate);
      setTimeSinceSurgery(getTimeSinceSurgery(procProfile.surgeryDate) || "");
    } else {
      setSurgeryDate("");
      setTimeSinceSurgery("");
    }
  }, [procedureProfiles]);

  const handlePromptSelect = useCallback((prompt: FaqPrompt | null, category: string) => {
    setSelectedPrompt(prompt);
    setSelectedCategory(category);
    if (prompt) {
      setForm((prev) => ({
        ...prev,
        title: prompt.question,
      }));
    }
    setStep("record");
  }, []);

  const handleRecordingComplete = useCallback((blob: Blob, duration: number, transcriptText?: string) => {
    setRecordedBlob(blob);
    setDurationSeconds(duration);
    setTranscript(transcriptText || "");
    if (mediaMode === "video") {
      setStep("choose-thumbnail");
    } else {
      setStep("details");
    }
  }, [mediaMode]);

  const handleThumbnailSelected = useCallback((blob: Blob) => {
    setThumbnailBlob(blob);
    setStep("details");
  }, []);

  const handleBackToRecord = useCallback(() => {
    setRecordedBlob(null);
    setDurationSeconds(0);
    setTranscript("");
    setThumbnailBlob(null);
    setStep("record");
  }, []);

  const handleBackToThumbnail = useCallback(() => {
    setThumbnailBlob(null);
    setStep("choose-thumbnail");
  }, []);

  const handleBackToPrompts = useCallback(() => {
    setRecordedBlob(null);
    setDurationSeconds(0);
    setTranscript("");
    setThumbnailBlob(null);
    setSelectedPrompt(null);
    setStep("select-prompt");
  }, []);

  const handleSubmit = async () => {
    if (!recordedBlob || !form.title) {
      setError("Please provide a title and recording");
      return;
    }

    setError(null);
    setUploading(true);
    setStep("uploading");

    try {
      // Step 1: Upload thumbnail if present
      let thumbnailUrl: string | null = null;
      if (thumbnailBlob) {
        const thumbFilename = `thumbnail-${Date.now()}.jpg`;
        const thumbPresignedRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: thumbFilename,
            contentType: "image/jpeg",
          }),
        });

        if (thumbPresignedRes.ok) {
          const { uploadUrl: thumbUploadUrl, fileUrl: thumbFileUrl } = await thumbPresignedRes.json();
          const thumbUploadRes = await fetch(thumbUploadUrl, {
            method: "PUT",
            body: thumbnailBlob,
            headers: { "Content-Type": "image/jpeg" },
          });
          if (thumbUploadRes.ok) {
            thumbnailUrl = thumbFileUrl;
          }
        }
      }

      // Step 2: Get presigned URL for recording
      const ext = isVideo ? ".webm" : ".webm";
      const filename = `recording-${Date.now()}${ext}`;
      const contentType = recordedBlob.type || (isVideo ? "video/webm" : "audio/webm");
      const presignedRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          contentType,
        }),
      });

      if (!presignedRes.ok) {
        const err = await presignedRes.json();
        throw new Error(err.error || "Failed to get upload URL");
      }

      const { uploadUrl, fileUrl } = await presignedRes.json();

      // Step 3: Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: recordedBlob,
        headers: {
          "Content-Type": contentType,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload recording");
      }

      // Step 4: Create recording in database
      const recordingRes = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: selectedCategory,
          mediaUrl: fileUrl,
          durationSeconds,
          isVideo,
          thumbnailUrl,
          faqPromptId: selectedPrompt?.id || null,
          transcription: transcript || null,
          transcriptionStatus: transcript ? "COMPLETED" : "NONE",
          procedureType: selectedProcedure || undefined,
          timeSinceSurgery: timeSinceSurgery || undefined,
        }),
      });

      if (!recordingRes.ok) {
        const err = await recordingRes.json();
        throw new Error(err.error || "Failed to create recording");
      }

      const recording = await recordingRes.json();

      onSuccess(recording);
    } catch (err) {
      console.error("Error submitting recording:", err);
      setError(err instanceof Error ? err.message : "Failed to submit recording");
      setStep("details");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center space-x-2">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === currentStepNumber;
            const isCompleted = stepNum < currentStepNumber;
            return (
              <div key={stepNum} className="flex items-center space-x-2">
                {i > 0 && <div className="w-12 h-0.5 bg-gray-200" />}
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive ? "bg-teal-600 text-white" : isCompleted ? "bg-teal-100 text-teal-700" : "bg-gray-200 text-gray-500"
                }`}>{stepNum}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Select prompt */}
      {step === "select-prompt" && (
        <div>
          {/* Video / Audio toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recording type
            </label>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-100">
              <button
                onClick={() => setMediaMode("video")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mediaMode === "video"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Video
                </span>
              </button>
              <button
                onClick={() => setMediaMode("audio")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mediaMode === "audio"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                  Audio
                </span>
              </button>
            </div>
          </div>

          {/* Procedure selector — shown first when guide has multiple procedures */}
          {procedureTypes.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What is this recording about?
              </label>
              <select
                value={selectedProcedure}
                onChange={(e) => handleProcedureChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {procedureTypes.map((proc) => (
                  <option key={proc} value={proc}>{proc}</option>
                ))}
              </select>
            </div>
          )}

          <FaqPromptSelector
            onSelect={handlePromptSelect}
            selectedPromptId={selectedPrompt?.id}
            conditionType={isChronicPainCondition(selectedProcedure) ? "CHRONIC_PAIN" : "SURGERY"}
          />
          <div className="mt-6 flex justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Record */}
      {step === "record" && (
        <div>
          <div className="mb-6">
            {selectedPrompt ? (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <p className="text-xs text-teal-600 font-medium mb-1">Your prompt:</p>
                <p className="text-teal-800">&ldquo;{selectedPrompt.question}&rdquo;</p>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">
                  Recording for: <span className="font-medium">{selectedCategory.replace(/_/g, " ")}</span>
                </p>
              </div>
            )}
          </div>

          {mediaMode === "video" ? (
            <VideoRecorder onRecordingComplete={handleRecordingComplete} />
          ) : (
            <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
          )}

          <div className="mt-6 flex justify-between">
            <button
              onClick={handleBackToPrompts}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Back to prompts
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 3 (video only): Choose thumbnail */}
      {step === "choose-thumbnail" && recordedBlob && (
        <ThumbnailSelector
          videoBlob={recordedBlob}
          onThumbnailSelected={handleThumbnailSelected}
          onBack={handleBackToRecord}
        />
      )}

      {/* Step 3/4: Details */}
      {step === "details" && (
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recording Details</h3>

          {/* Recording preview */}
          {recordedBlob && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Your recording ({Math.floor(durationSeconds / 60)}:{(durationSeconds % 60).toString().padStart(2, "0")})</span>
                <button
                  onClick={handleBackToRecord}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Re-record
                </button>
              </div>
              {isVideo ? (
                <video
                  src={URL.createObjectURL(recordedBlob)}
                  controls
                  playsInline
                  className="w-full rounded-lg"
                />
              ) : (
                <audio
                  src={URL.createObjectURL(recordedBlob)}
                  controls
                  className="w-full"
                />
              )}
            </div>
          )}

          {/* Thumbnail preview (video only) */}
          {isVideo && thumbnailBlob && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Thumbnail</span>
                <button
                  onClick={handleBackToThumbnail}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Change
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(thumbnailBlob)}
                alt="Selected thumbnail"
                className="w-full max-w-xs rounded-lg"
              />
            </div>
          )}

          {/* Media mode badge */}
          <div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              isVideo ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
            }`}>
              {isVideo ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
              {isVideo ? "Video recording" : "Audio recording"}
            </span>
          </div>

          {/* Procedure selector for guides with multiple procedures */}
          {procedureTypes.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recording for
              </label>
              <select
                value={selectedProcedure}
                onChange={(e) => handleProcedureChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {procedureTypes.map((proc) => (
                  <option key={proc} value={proc}>{proc}</option>
                ))}
              </select>
            </div>
          )}

          {/* Time since surgery/diagnosis for this recording */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isChronicPainCondition(selectedProcedure) ? "Time with condition" : "Recovery stage when recording"}
            </label>
            {surgeryDate ? (
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-teal-700">
                  {isChronicPainCondition(selectedProcedure)
                    ? getTimeSinceDiagnosisLabel(surgeryDate)
                    : getTimeSinceSurgeryLabel(surgeryDate)}
                </p>
                <p className="text-xs text-teal-600">
                  Based on your {isChronicPainCondition(selectedProcedure) ? "diagnosis" : "surgery"} date. This recording will be tagged as &quot;{timeSinceSurgery}&quot;.
                </p>
              </div>
            ) : (
              <>
                <select
                  value={timeSinceSurgery}
                  onChange={(e) => setTimeSinceSurgery(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Select timeframe</option>
                  {TIME_SINCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Set your {isChronicPainCondition(selectedProcedure) ? "diagnosis" : "surgery"} date in your profile to auto-calculate this.
                </p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="e.g., My Week-by-Week ACL Recovery Timeline"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={3}
              placeholder="Brief description of what you cover in this recording"
            />
          </div>

          {/* Transcript (auto-generated, editable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transcript {transcript ? "(auto-generated)" : "(none detected)"}
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={4}
              placeholder="Transcript will appear here if your browser supports speech recognition (Chrome/Edge). You can also type it manually."
            />
            {!transcript && (
              <p className="text-xs text-gray-500 mt-1">
                Tip: Use Chrome or Edge for automatic speech-to-text during recording.
              </p>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={isVideo ? handleBackToThumbnail : handleBackToRecord}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.title || uploading}
                className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Publish Recording
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploading */}
      {step === "uploading" && (
        <div className="py-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent mb-4" />
          <p className="text-gray-600">Uploading your recording...</p>
          <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
        </div>
      )}
    </div>
  );
}
