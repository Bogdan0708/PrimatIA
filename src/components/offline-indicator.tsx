"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type SyncStatus = "idle" | "offline" | "syncing" | "synced" | "error";

export function OfflineIndicator() {
  const t = useTranslations("payment");
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Handle online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setStatus("idle");
      // Trigger manual sync when coming back online
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "MANUAL_SYNC",
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen to service worker messages for sync status
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "SYNC_STATUS") {
        const { status: swStatus, message: swMessage } = event.data;

        switch (swStatus) {
          case "syncing":
            setStatus("syncing");
            setMessage(swMessage || t("syncing"));
            break;
          case "synced":
            setStatus("synced");
            setMessage(swMessage || t("syncedSuccess"));
            // Auto-hide success message after 5 seconds
            setTimeout(() => {
              setStatus("idle");
            }, 5000);
            break;
          case "error":
            setStatus("error");
            setMessage(swMessage || t("syncError"));
            // Auto-hide error message after 10 seconds
            setTimeout(() => {
              setStatus("idle");
            }, 10000);
            break;
          default:
            setStatus("idle");
        }
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage
      );

      // Start periodic sync fallback for browsers without Background Sync API
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "START_PERIODIC_SYNC",
        });
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleServiceWorkerMessage
        );
        // Stop periodic sync on unmount
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "STOP_PERIODIC_SYNC",
          });
        }
      }
    };
  }, [t]);

  // Don't show anything if we're online and idle
  if (isOnline && status === "idle") {
    return null;
  }

  // Offline banner
  if (!isOnline || status === "offline") {
    return (
      <Alert className="border-amber-500 bg-amber-50 text-amber-900 rounded-none border-x-0 border-t-0">
        <WifiOff className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-sm">
          {t("offlineMessage") ||
            "You are offline. Payments will be synced when reconnected."}
        </AlertDescription>
      </Alert>
    );
  }

  // Syncing banner
  if (status === "syncing") {
    return (
      <Alert className="border-blue-500 bg-blue-50 text-blue-900 rounded-none border-x-0 border-t-0">
        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
        <AlertDescription className="text-sm">
          {message || t("syncing") || "Syncing queued payments..."}
        </AlertDescription>
      </Alert>
    );
  }

  // Success banner
  if (status === "synced") {
    return (
      <Alert className="border-green-500 bg-green-50 text-green-900 rounded-none border-x-0 border-t-0">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-sm">
          {message || t("syncedSuccess") || "All payments synced!"}
        </AlertDescription>
      </Alert>
    );
  }

  // Error banner
  if (status === "error") {
    return (
      <Alert className="border-red-500 bg-red-50 text-red-900 rounded-none border-x-0 border-t-0">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-sm">
          {message || t("syncError") || "Error syncing payments. Will retry."}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
