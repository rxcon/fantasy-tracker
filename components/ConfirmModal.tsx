"use client";

import { TriangleAlert } from "lucide-react";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Remove",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-card border border-field-700 bg-field-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-espn/15 p-2">
            <TriangleAlert className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="font-display text-xl tracking-wide text-chalk-100">
              {title}
            </p>
            <p className="mt-1 text-sm text-chalk-500">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="focus-ring rounded-lg border border-field-700 px-4 py-2 text-sm font-semibold text-chalk-100 transition-colors hover:bg-field-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="focus-ring rounded-lg bg-espn px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
