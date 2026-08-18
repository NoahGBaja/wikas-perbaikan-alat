"use client";

import { toast } from "sonner";

export type FeedbackType = "error" | "success" | "info";

export type FeedbackMessage = {
  text: string;
  type: FeedbackType;
};

export function showError(title: string, description?: string) {
  toast.dismiss("app-feedback-success");
  toast.error(title, {
    id: "app-feedback-error",
    description,
    classNames: {
      toast: "!border-rose-700 !bg-rose-600 !text-white",
      title: "!text-white",
      description: "!text-rose-50",
      icon: "!text-white",
      closeButton: "!bg-white !text-rose-700",
    },
  });
}

export function showSuccess(title: string, description?: string) {
  toast.dismiss();
  toast.success(title, {
    id: "app-feedback-success",
    description,
    classNames: {
      toast: "!border-emerald-700 !bg-emerald-600 !text-white",
      title: "!text-white",
      description: "!text-emerald-50",
      icon: "!text-white",
      closeButton: "!bg-white !text-emerald-700",
    },
  });
}

export function toFeedback(text: string, type: FeedbackType): FeedbackMessage {
  return { text, type };
}

export function FeedbackBanner({
  message: _message,
  className = "",
}: {
  message: FeedbackMessage | null;
  className?: string;
}) {
  void _message;
  void className;
  return null;
}
