"use client";

import { useEffect } from "react";

/**
 * Small, consistent inline error/notice toast — replaces window.alert().
 * Renders a fixed pill at the bottom of the screen, auto-dismisses, and is
 * announced to assistive tech via role="alert". Pass `null`/empty to hide.
 */
export function Toast({
  message,
  tone = "error",
  duration = 4000,
  onDismiss,
}: {
  message: string | null;
  tone?: "error" | "gold";
  duration?: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`toast ${tone}`}
      role="alert"
      aria-live="assertive"
      onClick={onDismiss}
    >
      {tone === "error" && <span className="toast-dot" aria-hidden="true" />}
      {message}
    </div>
  );
}
