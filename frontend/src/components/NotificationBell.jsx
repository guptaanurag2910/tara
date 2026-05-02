import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import EmptyState from "./EmptyState";
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

export default function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const rootRef = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item && !item.is_read).length,
    [notifications],
  );

  async function refreshNotifications() {
    setLoading(true);
    setError("");
    try {
      const items = await fetchNotifications();
      setNotifications(items);
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
    async function load() {
      try {
        const items = await fetchNotifications();
        if (alive) {
          setNotifications(items);
        }
      } catch {
        if (alive) {
          setError("Could not load notifications.");
        }
      }
    }

    load();
    function onFocus() {
      load();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        load();
      }
    }
    const timerId = window.setInterval(load, 45000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(timerId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [token]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onPointerDown);
    }
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function onOpenToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await refreshNotifications();
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

  if (!token) {
    return null;
  }

  return (
    <div className="fixed right-3 top-3 z-50" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="Open notifications"
        className="tara-icon-button relative inline-flex h-10 w-10 items-center justify-center hover:border-[color:var(--tara-card-hover-border)]"
        onClick={onOpenToggle}
        type="button"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[color:var(--tara-color-destructive)] px-1.5 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="tara-modal-surface fixed inset-x-3 top-16 max-h-[70vh] overflow-hidden rounded-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <header className="flex items-center justify-between border-b border-[color:var(--tara-card-border)] px-4 py-3">
            <p className="text-sm font-semibold text-[color:var(--tara-text-primary)]">Notifications</p>
            {notifications.length > 0 ? (
              <button
                className="tara-chip tara-motion-pressable px-3 py-1 text-[11px] disabled:opacity-60"
                disabled={markingRead || unreadCount === 0}
                onClick={onMarkAllRead}
                type="button"
              >
                {markingRead ? "Marking..." : "Mark all read"}
              </button>
            ) : null}
          </header>

          <div className="max-h-[calc(70vh-56px)] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-5 text-sm text-[color:var(--tara-text-secondary)]">Loading notifications...</p>
            ) : null}

            {!loading && error ? (
              <p className="px-4 py-5 text-sm text-[color:var(--tara-color-destructive)]">{error}</p>
            ) : null}

            {!loading && !error && notifications.length === 0 ? (
              <div className="px-4 py-5">
                <EmptyState
                  compact
                  kind="notifications"
                  eyebrow="All clear"
                  icon="🔔"
                  title="Nothing new yet"
                  subtitle="New matches, likes, and messages will land here as they happen."
                  action={(
                    <Link
                      className="tara-primary-btn tara-motion-pressable inline-flex w-full items-center justify-center px-4 py-3 text-sm font-semibold"
                      onClick={() => setOpen(false)}
                      to="/discover"
                    >
                      Explore people
                    </Link>
                  )}
                />
              </div>
            ) : null}

            {!loading && !error && notifications.length > 0 ? (
              <ul className="divide-y divide-[color:var(--tara-card-border)]">
                {notifications.map((item, index) => (
                  <li
                    className={`px-4 py-3 ${item.is_read ? "bg-transparent" : "bg-[color:var(--tara-color-destructive-soft)]"}`}
                    key={item.id || `${item.timestamp || "n"}-${index}`}
                  >
                    <p className={`text-sm ${item.is_read ? "text-[color:var(--tara-text-secondary)]" : "font-semibold text-[color:var(--tara-text-primary)]"}`}>{item.text}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[color:var(--tara-text-faint)]">
                      <span className="capitalize">{item.type}</span>
                      <span>{formatNotificationTime(item.timestamp)}</span>
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
