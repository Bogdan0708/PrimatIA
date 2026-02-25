"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, FileText, CreditCard, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  subject: string;
  bodyText: string | null;
  canal: string;
  triggerEvent: string | null;
  createdAt: string;
  readAt: string | null;
}

interface NotificationBellProps {
  translations: {
    notifications: string;
    noNotifications: string;
    markAllRead: string;
  };
}

const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  payment_confirmation: CreditCard,
  decizie_ready: FileText,
  certificat_ready: FileText,
  somatie_generated: AlertTriangle,
  payment_reminder_before: Clock,
  payment_reminder_due: Clock,
  payment_reminder_after: AlertTriangle,
};

export function NotificationBell({ translations }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications on mount + poll every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/portal/notifications");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.data ?? []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch("/api/portal/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await fetch("/api/portal/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silently fail
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "acum";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}z`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="text-gray-600 relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">{translations.notifications}</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-portal-primary h-auto py-1"
                onClick={markAllRead}
                disabled={loading}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                {translations.markAllRead}
              </Button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                {translations.noNotifications}
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = eventIcons[n.triggerEvent ?? ""] ?? Bell;
                const isUnread = !n.readAt;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors",
                      isUnread && "bg-portal-primary-subtle/30"
                    )}
                    onClick={() => isUnread && markRead(n.id)}
                  >
                    <div className={cn(
                      "mt-0.5 flex-shrink-0 rounded-full p-1.5",
                      isUnread ? "bg-portal-primary-subtle text-portal-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", isUnread && "font-medium")}>
                        {n.subject}
                      </p>
                      {n.bodyText && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {n.bodyText}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {isUnread && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-2 w-2 rounded-full bg-portal-primary" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
