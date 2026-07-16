"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  ticket: string | null;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadNotifications() {
    const res = await fetch("/api/notifications", { cache: "no-store" });

    if (!res.ok) return;

    const data = await res.json();
    setItems(data.notifications || []);
    setUnreadCount(Number(data.unreadCount || 0));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  async function markRead() {
    setOpen((current) => !current);

    if (unreadCount > 0) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ read: true }),
      });
      setUnreadCount(0);
      setItems((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void markRead()}
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
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="font-semibold">Notifikasi</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">
                Belum ada notifikasi.
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
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
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
