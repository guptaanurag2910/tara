import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useAuth } from "../hooks/useAuth";
import { fetchNotifications, markNotificationsRead } from "../services/notificationService";

function formatNotificationTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BellIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0m6 0H9" />
    </svg>
  );
}

export default function NotificationBell({ light = false }) {
  const { token } = useAuth();
  const router = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const rootRef = useRef(null);
  const lastLoadedAtRef = useRef(0);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item && !item.is_read).length,
    [notifications],
  );

  async function refreshNotifications({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastLoadedAtRef.current < 15000) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const items = await fetchNotifications();
      setNotifications(items);
      lastLoadedAtRef.current = now;
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return undefined;
    }

    let alive = true;
    async function load({ force = false } = {}) {
      const now = Date.now();
      if (!force && now - lastLoadedAtRef.current < 15000) {
        return;
      }

      try {
        const items = await fetchNotifications();
        if (alive) {
          setNotifications(items);
          lastLoadedAtRef.current = now;
        }
      } catch {
        if (alive) {
          setError("Could not load notifications.");
        }
      }
    }

    load({ force: true });
    function onFocus() {
      load();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        load();
      }
    }
    const timerId = window.setInterval(load, 30000);
    function onNotificationRefresh() { load({ force: true }); }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("tara-notifications-refresh", onNotificationRefresh);
    return () => {
      alive = false;
      window.clearInterval(timerId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("tara-notifications-refresh", onNotificationRefresh);
    };
  }, [token]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
    }
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onOpenToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await refreshNotifications({ force: true });
    }
  }

  async function onMarkAllRead() {
    if (markingRead || unreadCount === 0) {
      return;
    }
    setMarkingRead(true);
    setError("");
    try {
      await markNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch {
      setError("Could not mark notifications as read.");
    } finally {
      setMarkingRead(false);
    }
  }

  async function onMarkOneRead(item) {
    if (item.is_read) return;
    try {
      await markNotificationsRead([item.id]);
      setNotifications((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry));
    } catch {
      setError("Could not mark this notification as read.");
    }
  }

  async function onOpenNotification(item) {
    if (!item.is_read) await onMarkOneRead(item);
    const destination = typeof item.action_url === "string" && item.action_url.startsWith("/") && !item.action_url.startsWith("//")
      ? item.action_url
      : item.type === "recommendation" ? "/discover" : item.type === "match" ? "/matches" : "/chat";
    setOpen(false);
    router({ to: destination });
  }

  if (!token) {
    return null;
  }

  return (
    <div className={`fixed right-3 top-3 ${open ? "z-[100]" : "z-50"} ${light ? "tara-light-notification-bell" : ""}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="Open notifications"
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition ${light ? "border border-[#dbdbdb] bg-white text-[#262626] hover:border-[#0095f6]" : "border border-white/25 bg-slate-900/80 text-slate-100 hover:border-rose-200/60"}`}
        onClick={onOpenToggle}
        type="button"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section aria-label="Notifications" className="notification-panel" role="dialog">
          <header className="notification-panel-header">
            <div><h2>Notifications</h2><p>{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}</p></div>
            <button aria-label="Close notifications" className="notification-close" onClick={() => setOpen(false)} type="button">×</button>
          </header>

          {unreadCount > 0 ? <button className="notification-mark-read" disabled={markingRead} onClick={onMarkAllRead} type="button">{markingRead ? "Marking..." : "Mark all read"}</button> : null}

          <div className="notification-panel-content">
            {loading ? (
              <p className="notification-status">Loading notifications...</p>
            ) : null}

            {!loading && error ? (
              <div className="notification-status notification-error"><p>{error}</p><button onClick={() => refreshNotifications({ force: true })} type="button">Try again</button></div>
            ) : null}

            {!loading && !error && notifications.length === 0 ? (
              <div className="notification-empty"><span><BellIcon /></span><strong>No updates yet</strong><p>New connections, messages and game turns will show up here.</p></div>
            ) : null}

            {!loading && !error && notifications.length > 0 ? (
              <ul className="notification-list">
                {notifications.map((item, index) => (
                  <li
                    className={item.is_read ? "" : "is-unread"}
                    key={item.id || `${item.timestamp || "n"}-${index}`}
                  >
                    <span className="notification-dot" aria-hidden="true" />
                    <div className="notification-item-copy">
                      <button className="notification-open" onClick={() => onOpenNotification(item)} type="button">
                        <p>{item.text}</p>
                        <div>
                          <span>{item.type === "match" ? "Connection" : item.type === "game_turn" ? "Game turn" : item.type === "recommendation" ? "Discover" : "Message"}</span>
                          <span>{formatNotificationTime(item.timestamp)}</span>
                        </div>
                        <span className="notification-action-hint">Open →</span>
                      </button>
                      {!item.is_read ? <button aria-label="Mark as read" className="notification-item-read" onClick={() => onMarkOneRead(item)} type="button">Mark read</button> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
