import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getStoredToken } from "../services/tokenStorage";

const DEFAULT_MAX_RETRIES = 6;

function buildSocketUrl(matchId) {
  const explicit = import.meta.env.VITE_WS_BASE_URL;
  const inferredProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const inferredHost = `${window.location.hostname}:8000`;
  const baseUrl = explicit || `${inferredProtocol}//${inferredHost}`;
  const trimmed = String(baseUrl).replace(/\/$/, "");
  const token = getStoredToken();

  const url = new URL(`${trimmed}/ws/chat/${matchId}/`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

function messageIdentity(message) {
  if (message?.id) {
    return `id:${message.id}`;
  }
  if (message?.client_message_id) {
    return `cid:${message.client_message_id}`;
  }
  return `${message?.sender_id || "na"}:${message?.timestamp || message?.created_at || "na"}:${message?.content || ""}`;
}

function mergeMessage(list, incoming) {
  if (!incoming || typeof incoming !== "object") {
    return list;
  }
  const nextIdentity = messageIdentity(incoming);
  const existingIndex = list.findIndex((item) => messageIdentity(item) === nextIdentity);
  if (existingIndex >= 0) {
    const next = [...list];
    next[existingIndex] = { ...next[existingIndex], ...incoming };
    return next;
  }
  return [...list, incoming];
}

function parseSocketPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return { event: "unknown", data: {} };
  }
  if (typeof raw.event === "string") {
    if (raw.event === "error") {
      return { event: raw.event, data: raw };
    }
    return { event: raw.event, data: raw.data ?? {} };
  }
  if (raw.type === "chat.message" && raw.payload) {
    return { event: "new_message", data: raw.payload };
  }
  if (raw.error) {
    return { event: "error", data: raw };
  }
  // Legacy: backend may send plain message payload.
  return { event: "new_message", data: raw };
}

function resolveHookConfig(matchIdOrConfig) {
  if (matchIdOrConfig && typeof matchIdOrConfig === "object") {
    return {
      matchId: matchIdOrConfig.matchId,
      enabled: matchIdOrConfig.enabled ?? true,
      maxRetries: matchIdOrConfig.maxRetries ?? DEFAULT_MAX_RETRIES,
      onMessage: matchIdOrConfig.onMessage,
    };
  }
  return {
    matchId: matchIdOrConfig,
    enabled: true,
    maxRetries: DEFAULT_MAX_RETRIES,
    onMessage: undefined,
  };
}

export function useChatSocket(matchIdOrConfig) {
  const { matchId, enabled, maxRetries, onMessage } = resolveHookConfig(matchIdOrConfig);

  const socketRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const manualCloseRef = useRef(false);
  const onMessageRef = useRef(onMessage);

  const [status, setStatus] = useState("idle");
  const [lastError, setLastError] = useState("");
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState({
    new_message: null,
    game_invite: null,
    game_invite_updated: null,
    game_started: null,
    game_update: null,
    game_round_result: null,
    game_result: null,
    game_session_completed: null,
    tic_tac_toe_update: null,
    dots_boxes_update: null,
    snakes_ladders_state: null,
    snakes_ladders_update: null,
    bingo_state: null,
    bingo_update: null,
    spot_difference_state: null,
    spot_difference_update: null,
    memory_match_state: null,
    memory_match_update: null,
    pictionary_state: null,
    pictionary_update: null,
    word_search_state: null,
    word_search_update: null,
    unscramble_state: null,
    unscramble_update: null,
    unscramble_feedback: null,
    word_association_state: null,
    word_association_update: null,
    collaborative_playlist_state: null,
    collaborative_playlist_update: null,
    mystery_playlist_mood_state: null,
    mystery_playlist_mood_update: null,
  });

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      manualCloseRef.current = true;
      socket.close();
      socketRef.current = null;
    }
    clearRetryTimer();
  }, [clearRetryTimer]);

  const connect = useCallback(() => {
    if (!enabled || !matchId) {
      return;
    }
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) {
      return;
    }

    manualCloseRef.current = false;
    setStatus("connecting");
    setLastError("");

    const socket = new WebSocket(buildSocketUrl(matchId));
    socketRef.current = socket;

    socket.onopen = () => {
      if (socketRef.current !== socket) {
        return;
      }
      retryCountRef.current = 0;
      setStatus("connected");
      setLastError("");
    };

    socket.onmessage = (event) => {
      try {
        const parsedRaw = JSON.parse(event.data);
        const parsed = parseSocketPayload(parsedRaw);
        const eventName = String(parsed.event || "").toLowerCase();
        const eventData = parsed.data ?? {};

        window.dispatchEvent(new CustomEvent("tara-notifications-refresh", { detail: { event: eventName } }));

        if (eventName === "new_message") {
          setMessages((prev) => mergeMessage(prev, eventData));
          setEvents((prev) => ({ ...prev, new_message: eventData }));
        } else if (eventName === "game_started") {
          setLastError("");
          if (eventData?.message) {
            setMessages((prev) => mergeMessage(prev, eventData.message));
          }
          setEvents((prev) => ({ ...prev, game_started: eventData }));
        } else if (eventName === "game_invite" || eventName === "game_invite_updated") {
          setLastError("");
          if (eventData?.message) {
            setMessages((prev) => mergeMessage(prev, eventData.message));
          }
          setEvents((prev) => ({ ...prev, [eventName]: eventData }));
        } else if (eventName === "game_update") {
          setEvents((prev) => ({ ...prev, game_update: eventData }));
        } else if (eventName === "tic_tac_toe_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, tic_tac_toe_update: eventData }));
        } else if (eventName === "dots_boxes_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, dots_boxes_update: eventData }));
        } else if (eventName === "snakes_ladders_state") {
          setEvents((prev) => ({ ...prev, snakes_ladders_state: eventData }));
        } else if (eventName === "snakes_ladders_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, snakes_ladders_update: eventData }));
        } else if (eventName === "bingo_state") {
          setEvents((prev) => ({ ...prev, bingo_state: eventData }));
        } else if (eventName === "bingo_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, bingo_update: eventData }));
        } else if (eventName === "spot_difference_state") {
          setLastError("");
          setEvents((prev) => ({ ...prev, spot_difference_state: eventData }));
        } else if (eventName === "spot_difference_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, spot_difference_update: eventData }));
        } else if (eventName === "memory_match_state") {
          setLastError("");
          setEvents((prev) => ({ ...prev, memory_match_state: eventData }));
        } else if (eventName === "memory_match_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, memory_match_update: eventData }));
        } else if (eventName === "pictionary_state") {
          setEvents((prev) => ({ ...prev, pictionary_state: eventData }));
        } else if (eventName === "pictionary_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, pictionary_update: eventData }));
        } else if (eventName === "word_search_state") {
          setEvents((prev) => ({ ...prev, word_search_state: eventData }));
        } else if (eventName === "word_search_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, word_search_update: eventData }));
        } else if (eventName === "unscramble_state") {
          setEvents((prev) => ({ ...prev, unscramble_state: eventData }));
        } else if (eventName === "unscramble_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, unscramble_update: eventData }));
        } else if (eventName === "unscramble_feedback") {
          setEvents((prev) => ({ ...prev, unscramble_feedback: eventData }));
        } else if (eventName === "word_association_state") {
          setEvents((prev) => ({ ...prev, word_association_state: eventData }));
        } else if (eventName === "word_association_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, word_association_update: eventData }));
        } else if (eventName === "collaborative_playlist_state") {
          setEvents((prev) => ({ ...prev, collaborative_playlist_state: eventData }));
        } else if (eventName === "collaborative_playlist_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, collaborative_playlist_update: eventData }));
        } else if (eventName === "mystery_playlist_mood_state") {
          setEvents((prev) => ({ ...prev, mystery_playlist_mood_state: eventData }));
        } else if (eventName === "mystery_playlist_mood_update") {
          setLastError("");
          setEvents((prev) => ({ ...prev, mystery_playlist_mood_update: eventData }));
        } else if (eventName === "game_round_result") {
          if (eventData?.message) {
            setMessages((prev) => mergeMessage(prev, eventData.message));
          }
          setEvents((prev) => ({ ...prev, game_round_result: eventData }));
        } else if (eventName === "game_result") {
          if (eventData?.message) {
            setMessages((prev) => mergeMessage(prev, eventData.message));
          }
          setEvents((prev) => ({ ...prev, game_result: eventData }));
        } else if (eventName === "game_session_completed") {
          const completedMessages = Array.isArray(eventData?.messages) ? eventData.messages : [];
          setMessages((prev) => completedMessages.reduce((next, message) => mergeMessage(next, message), prev));
          setEvents((prev) => ({ ...prev, game_session_completed: eventData }));
        } else if (eventName === "error" && eventData?.error) {
          setLastError(String(eventData.error));
        }

        // Backward-compat callback contract used in Chat.jsx.
        if (eventName === "new_message" && eventData && typeof eventData === "object") {
          onMessageRef.current?.({
            event: "new_message",
            ...eventData,
            data: eventData,
          });
        } else {
          onMessageRef.current?.({
            event: parsed.event,
            data: eventData,
          });
        }
      } catch {
        // Ignore malformed payloads to keep socket alive.
      }
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) {
        return;
      }
      setStatus("error");
      setLastError("Live connection error. Switching to fallback mode.");
    };

    socket.onclose = (closeEvent) => {
      if (socketRef.current !== socket) {
        return;
      }
      socketRef.current = null;
      if (manualCloseRef.current) {
        setStatus("idle");
        return;
      }

      setStatus("disconnected");
      if (closeEvent?.code === 4401 || closeEvent?.code === 4403) {
        setLastError("Socket authorization failed. Please login again.");
        return;
      }

      if (retryCountRef.current >= maxRetries) {
        setLastError("Live chat unavailable right now. Using backup messaging.");
        return;
      }

      const backoffMs = Math.min(1000 * 2 ** retryCountRef.current, 15000);
      retryCountRef.current += 1;
      retryTimerRef.current = window.setTimeout(connect, backoffMs);
    };
  }, [enabled, matchId, maxRetries]);

  useEffect(() => {
    if (!enabled || !matchId) {
      disconnect();
      setStatus("idle");
      return;
    }
    connect();
    return () => {
      disconnect();
    };
  }, [enabled, matchId, connect, disconnect]);

  const sendJson = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendMessage = useCallback(
    (text, clientMessageId, replyToId) => {
      const content = String(text || "").trim();
      if (!content) {
        return false;
      }
      const data = { content };
      if (clientMessageId) {
        data.client_message_id = clientMessageId;
      }
      if (replyToId) {
        data.reply_to_id = replyToId;
      }
      return sendJson({ event: "send_message", data });
    },
    [sendJson],
  );

  const startGame = useCallback(
    (category) => {
      const categoryValue = String(category || "").trim();
      if (!categoryValue) {
        return false;
      }
      return sendJson({ event: "start_game", data: { category: categoryValue } });
    },
    [sendJson],
  );

  const respondGameInvite = useCallback(
    (sessionId, action) => {
      const parsedSessionId = Number(sessionId);
      const normalizedAction = String(action || "").trim().toLowerCase();
      if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0 || !["accept", "decline"].includes(normalizedAction)) {
        return false;
      }
      return sendJson({
        event: "respond_game_invite",
        data: { session_id: parsedSessionId, action: normalizedAction },
      });
    },
    [sendJson],
  );

  const answerQuestion = useCallback(
    (data) => {
      if (!data || typeof data !== "object") {
        return false;
      }
      return sendJson({ event: "answer_question", data });
    },
    [sendJson],
  );

  const moveTicTacToe = useCallback(
    (data) => {
      if (!data || typeof data !== "object") return false;
      return sendJson({ event: "tic_tac_toe_move", data });
    },
    [sendJson],
  );
  const moveDotsBoxes = useCallback((data) => {
    if (!data || typeof data !== "object") return false;
    return sendJson({ event: "dots_boxes_move", data });
  }, [sendJson]);
  const requestSnakesLaddersState = useCallback((sessionId) => sendJson({
    event: "snakes_ladders_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const actSnakesLadders = useCallback((data) => {
    if (!data || typeof data !== "object") return false;
    return sendJson({ event: "snakes_ladders_action", data });
  }, [sendJson]);
  const requestBingoState = useCallback((sessionId) => sendJson({
    event: "bingo_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const actBingo = useCallback((data) => {
    if (!data || typeof data !== "object") return false;
    return sendJson({ event: "bingo_action", data });
  }, [sendJson]);

  const requestPictionaryState = useCallback((sessionId) => sendJson({
    event: "pictionary_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const requestSpotDifferenceState = useCallback((sessionId) => sendJson({
    event: "spot_difference_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const actSpotDifference = useCallback((data) => {
    if (!data || typeof data !== "object") return false;
    return sendJson({ event: "spot_difference_action", data });
  }, [sendJson]);
  const requestMemoryMatchState = useCallback((sessionId) => sendJson({
    event: "memory_match_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const actMemoryMatch = useCallback((data) => {
    if (!data || typeof data !== "object") return false;
    return sendJson({ event: "memory_match_action", data });
  }, [sendJson]);
  const submitPictionaryDrawing = useCallback((data) => sendJson({ event: "pictionary_submit_drawing", data }), [sendJson]);
  const submitPictionaryGuess = useCallback((data) => sendJson({ event: "pictionary_submit_guess", data }), [sendJson]);
  const giveUpPictionary = useCallback((data) => sendJson({ event: "pictionary_give_up", data }), [sendJson]);
  const requestWordSearchState = useCallback((sessionId) => sendJson({
    event: "word_search_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const selectWordSearchCells = useCallback((data) => sendJson({ event: "word_search_select", data }), [sendJson]);
  const requestUnscrambleState = useCallback((sessionId) => sendJson({
    event: "unscramble_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const submitUnscramble = useCallback((data) => sendJson({ event: "unscramble_submit", data }), [sendJson]);
  const requestWordAssociationState = useCallback((sessionId) => sendJson({
    event: "word_association_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const submitWordAssociation = useCallback((data) => sendJson({ event: "word_association_submit", data }), [sendJson]);
  const requestCollaborativePlaylistState = useCallback((sessionId) => sendJson({
    event: "collaborative_playlist_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const submitCollaborativePlaylistTrack = useCallback((data) => sendJson({
    event: "collaborative_playlist_submit", data,
  }), [sendJson]);
  const requestMysteryPlaylistMoodState = useCallback((sessionId) => sendJson({
    event: "mystery_playlist_mood_state_request", data: { session_id: Number(sessionId) },
  }), [sendJson]);
  const submitMysteryPlaylistMood = useCallback((data) => sendJson({
    event: "mystery_playlist_mood_submit", data,
  }), [sendJson]);

  return useMemo(
    () => ({
      status,
      isConnected: status === "connected",
      lastError,
      messages,
      events,
      sendMessage,
      startGame,
      respondGameInvite,
      answerQuestion,
      moveTicTacToe,
      moveDotsBoxes,
      requestSnakesLaddersState,
      actSnakesLadders,
      requestBingoState,
      actBingo,
      requestSpotDifferenceState,
      actSpotDifference,
      requestMemoryMatchState,
      actMemoryMatch,
      requestPictionaryState,
      submitPictionaryDrawing,
      submitPictionaryGuess,
      giveUpPictionary,
      requestWordSearchState,
      selectWordSearchCells,
      requestUnscrambleState,
      submitUnscramble,
      requestWordAssociationState,
      submitWordAssociation,
      requestCollaborativePlaylistState,
      submitCollaborativePlaylistTrack,
      requestMysteryPlaylistMoodState,
      submitMysteryPlaylistMood,
      reconnect: connect,
      disconnect,
      setMessages,
    }),
    [
      status,
      lastError,
      messages,
      events,
      sendMessage,
      requestSnakesLaddersState,
      actSnakesLadders,
      requestBingoState,
      actBingo,
      requestSpotDifferenceState,
      actSpotDifference,
      requestMemoryMatchState,
      actMemoryMatch,
      startGame,
      respondGameInvite,
      answerQuestion,
      moveTicTacToe,
      moveDotsBoxes,
      requestPictionaryState,
      submitPictionaryDrawing,
      submitPictionaryGuess,
      giveUpPictionary,
      requestWordSearchState,
      selectWordSearchCells,
      requestUnscrambleState,
      submitUnscramble,
      requestWordAssociationState,
      submitWordAssociation,
      requestCollaborativePlaylistState,
      submitCollaborativePlaylistTrack,
      requestMysteryPlaylistMoodState,
      submitMysteryPlaylistMood,
      connect,
      disconnect,
    ],
  );
}
