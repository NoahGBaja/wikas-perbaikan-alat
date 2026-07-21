"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  reportId: number | null;
  href: string | null;
  ticket: string | null;
};

type NotificationBellProps = {
  onReportClick?: (reportId: number) => boolean | Promise<boolean>;
};

const NOTIFICATION_POLL_INTERVAL_MS = 5_000;

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default function NotificationBell({
  onReportClick,
}: NotificationBellProps = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  async function loadNotifications(signal?: AbortSignal) {
    try {
      const res = await fetch("/api/notifications", {
        cache: "no-store",
        signal,
      });

      if (!res.ok) return;

      const data = await res.json();
      setItems(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      console.error("LOAD_NOTIFICATIONS_ERROR:", error);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    function refreshNotifications() {
      if (document.visibilityState === "visible") {
        void loadNotifications(controller.signal);
      }
    }

    refreshNotifications();
    const interval = window.setInterval(
      refreshNotifications,
      NOTIFICATION_POLL_INTERVAL_MS,
    );
    window.addEventListener("focus", refreshNotifications);
    document.addEventListener("visibilitychange", refreshNotifications);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshNotifications);
      document.removeEventListener("visibilitychange", refreshNotifications);
    };
  }, []);

  function toggleNotifications() {
    setOpen((current) => !current);
  }

  async function markAllRead() {
    if (unreadCount === 0 || markingAllRead) return;

    const readAt = new Date().toISOString();
    setMarkingAllRead(true);
    setUnreadCount(0);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt || readAt,
      })),
    );

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ readAll: true }),
      });

      if (!res.ok) {
        await loadNotifications();
      }
    } catch (error) {
      console.error("READ_ALL_NOTIFICATIONS_ERROR:", error);
      await loadNotifications();
    } finally {
      setMarkingAllRead(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, readAt }
            : notification,
        ),
      );
      setUnreadCount((current) => Math.max(current - 1, 0));

      void fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: item.id }),
      }).catch((error) => {
        console.error("READ_NOTIFICATION_ERROR:", error);
      });
    }

    setOpen(false);

    if (item.reportId && onReportClick) {
      const opened = await onReportClick(item.reportId);

      if (opened) return;
    }

    if (item.href) {
      router.push(item.href);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleNotifications}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-blue-50"
        aria-label="Notifikasi"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="font-semibold">Notifikasi</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={markingAllRead}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 transition hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCheck className="h-4 w-4" />
                {markingAllRead ? "Memproses..." : "Tandai semua dibaca"}
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">
                Belum ada notifikasi.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openNotification(item)}
                  className={`relative block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                    item.readAt
                      ? "bg-white hover:bg-slate-50"
                      : "bg-blue-50/70 hover:bg-blue-50"
                  } ${item.href ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        item.readAt ? "bg-transparent" : "bg-blue-600"
                      }`}
                      aria-label={item.readAt ? undefined : "Belum dibaca"}
                      title={item.readAt ? undefined : "Belum dibaca"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      {item.ticket ? (
                        <p className="mt-1 text-xs font-semibold text-blue-700">
                          {item.ticket}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {item.message}
                      </p>
                      <time
                        dateTime={item.createdAt}
                        className="mt-2 block text-xs font-medium text-slate-500"
                      >
                        {formatNotificationDate(item.createdAt)} WIB
                      </time>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
