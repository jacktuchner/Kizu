/**
 * Daily.co video room integration utilities
 *
 * To use this integration, add DAILY_API_KEY to your environment variables.
 * Get your API key from: https://dashboard.daily.co/developers
 */

export interface DailyRoom {
  id: string;
  name: string;
  url: string;
  privacy: string;
  config: {
    exp?: number;
    enable_chat?: boolean;
    enable_screenshare?: boolean;
    enable_knocking?: boolean;
    start_video_off?: boolean;
    start_audio_off?: boolean;
  };
  created_at: string;
}

export interface CreateRoomOptions {
  callId: string;
  expiresInMinutes?: number;
  enableChat?: boolean;
  enableScreenshare?: boolean;
  maxParticipants?: number;
}

/**
 * Creates a Daily.co video room for a call
 */
export async function createRoom(options: CreateRoomOptions): Promise<string> {
  const { callId, expiresInMinutes = 120, enableChat = true, enableScreenshare = true, maxParticipants } = options;

  const apiKey = process.env.DAILY_API_KEY;

  if (!apiKey) {
    console.error("DAILY_API_KEY is not set in environment variables");
    throw new Error("Video conferencing is not configured");
  }

  try {
    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `call-${callId}`,
        privacy: "private",
        properties: {
          exp: Math.floor(Date.now() / 1000) + expiresInMinutes * 60,
          enable_chat: enableChat,
          enable_screenshare: enableScreenshare,
          enable_knocking: false,
          start_video_off: false,
          start_audio_off: false,
          max_participants: maxParticipants || 2,
          eject_at_room_exp: true,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Daily.co API error:", error);
      throw new Error(error.error || "Failed to create video room");
    }

    const data: DailyRoom = await response.json();
    return data.url;
  } catch (error) {
    console.error("Error creating Daily.co room:", error);
    throw error;
  }
}

/**
 * Creates a meeting token for a private Daily.co room
 */
export async function createMeetingToken(options: {
  roomName: string;
  userName: string;
  userId: string;
  isOwner: boolean;
  expiresInMinutes?: number;
}): Promise<string> {
  const { roomName, userName, userId, isOwner, expiresInMinutes = 120 } = options;

  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    throw new Error("Video conferencing is not configured");
  }

  const response = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        user_id: userId,
        is_owner: isOwner,
        exp: Math.floor(Date.now() / 1000) + expiresInMinutes * 60,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Daily.co meeting token error:", error);
    throw new Error(error.error || "Failed to create meeting token");
  }

  const data = await response.json();
  return data.token;
}

/**
 * Deletes a Daily.co room by name
 */
export async function deleteRoom(roomName: string): Promise<void> {
  const apiKey = process.env.DAILY_API_KEY;

  if (!apiKey) {
    console.warn("DAILY_API_KEY not set, skipping room deletion");
    return;
  }

  try {
    const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      console.error("Error deleting Daily.co room:", error);
    }
  } catch (error) {
    console.error("Error deleting Daily.co room:", error);
  }
}

/**
 * Gets information about a Daily.co room
 */
export async function getRoom(roomName: string): Promise<DailyRoom | null> {
  const apiKey = process.env.DAILY_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error("Failed to get room");
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting Daily.co room:", error);
    return null;
  }
}
