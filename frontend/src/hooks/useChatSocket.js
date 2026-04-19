import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getStoredToken } from "../services/tokenStorage";

const DEFAULT_MAX_RETRIES = 6;

function buildSocketUrl(matchId) {
  const explicit = import.meta.env.VITE_WS_BASE_URL;
  const baseUrl = explicit || "ws://localhost:8000";
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
    game_started: null,
    game_update: null,
    game_result: null,
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

        if (eventName === "new_message") {
          setMessages((prev) => mergeMessage(prev, eventData));
          setEvents((prev) => ({ ...prev, new_message: eventData }));
        } else if (eventName === "game_started") {
          if (eventData?.message) {
            setMessages((prev) => mergeMessage(prev, eventData.message));
          }
          setEvents((prev) => ({ ...prev, game_started: eventData }));
        } else if (eventName === "game_update") {
          setEvents((prev) => ({ ...prev, game_update: eventData }));
        } else if (eventName === "game_result") {
          if (eventData?.message) {
            setMessages((prev) => mergeMessage(prev, eventData.message));
          }
          setEvents((prev) => ({ ...prev, game_result: eventData }));
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
      setStatus("error");
      setLastError("Live connection error. Switching to fallback mode.");
    };

    socket.onclose = (closeEvent) => {
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
    (text, clientMessageId) => {
      const content = String(text || "").trim();
      if (!content) {
        return false;
      }
      const data = { content };
      if (clientMessageId) {
        data.client_message_id = clientMessageId;
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

  const answerQuestion = useCallback(
    (data) => {
      if (!data || typeof data !== "object") {
        return false;
      }
      return sendJson({ event: "answer_question", data });
    },
    [sendJson],
  );

  return useMemo(
    () => ({
      status,
      isConnected: status === "connected",
      lastError,
      messages,
      events,
      sendMessage,
      startGame,
      answerQuestion,
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
      startGame,
      answerQuestion,
      connect,
      disconnect,
    ],
  );
}
