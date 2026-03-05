"use client";

import { useState, useEffect, useRef } from "react";
import { parseDate } from "@/lib/dates";

interface VideoCallProps {
  roomUrl: string;
  callId: string;
  scheduledAt: string;
  durationMinutes: number;
  type?: "call" | "group-session";
  onLeave?: () => void;
}

export default function VideoCall({
  roomUrl,
  callId,
  scheduledAt,
  durationMinutes,
  type = "call",
  onLeave,
}: VideoCallProps) {
  const [isReady, setIsReady] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [tokenizedUrl, setTokenizedUrl] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [timeUntilCall, setTimeUntilCall] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Check if call time is near (within 15 minutes before to end of call)
    const checkTime = () => {
      const now = new Date();
      const callStart = parseDate(scheduledAt);
      const callEnd = new Date(callStart.getTime() + durationMinutes * 60 * 1000);
      const earlyJoinWindow = new Date(callStart.getTime() - 15 * 60 * 1000); // 15 min before

      if (now >= earlyJoinWindow && now <= callEnd) {
        setIsReady(true);
        setTimeUntilCall("");
      } else if (now < earlyJoinWindow) {
        setIsReady(false);
        const diff = earlyJoinWindow.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
          setTimeUntilCall(`${hours}h ${minutes}m until you can join`);
        } else {
          setTimeUntilCall(`${minutes}m until you can join`);
        }
      } else {
        setIsReady(false);
        setTimeUntilCall("This call has ended");
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [scheduledAt, durationMinutes]);

  const handleJoinCall = async () => {
    setIsLoadingToken(true);
    setTokenError(null);
    try {
      const endpoint = type === "group-session"
        ? `/api/group-sessions/${callId}/token`
        : `/api/calls/${callId}/token`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get meeting token");
      }
      const { token } = await res.json();
      setTokenizedUrl(`${roomUrl}?t=${token}`);
      setHasJoined(true);
    } catch (err: any) {
      setTokenError(err.message || "Failed to join call");
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleLeaveCall = () => {
    setHasJoined(false);
    setTokenizedUrl(null);
    if (onLeave) onLeave();
  };

  if (!isReady) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-teal-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Video Call</h3>
        <p className="text-gray-600 mb-4">{timeUntilCall}</p>
        <p className="text-sm text-gray-500">
          You can join the call up to 15 minutes before the scheduled time.
        </p>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Join</h3>
          <p className="text-gray-600 mb-6">
            Click below to join your video call. Make sure your camera and microphone are ready.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-2">Before you join:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Find a quiet, private space
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Test your camera and microphone
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ensure stable internet connection
            </li>
          </ul>
        </div>

        {tokenError && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4">{tokenError}</div>
        )}

        <button
          onClick={handleJoinCall}
          disabled={isLoadingToken}
          className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingToken ? (
            <span>Connecting...</span>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Join Video Call
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-900 p-3 flex items-center justify-between">
        <span className="text-white text-sm font-medium">Video Call</span>
        <button
          onClick={handleLeaveCall}
          className="bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
        >
          Leave Call
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={tokenizedUrl || roomUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full aspect-video min-h-[400px]"
        title="Video Call"
      />
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">
          Having trouble? Try refreshing the page and joining again.
        </p>
      </div>
    </div>
  );
}
