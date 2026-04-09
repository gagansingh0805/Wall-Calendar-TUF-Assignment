"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type QuickAddModalProps = {
  open: boolean;
  defaultDateKey: string;
  onClose: () => void;
  onSubmit: (payload: { text: string; dueDate: string }) => void;
};

export function QuickAddModal({ open, defaultDateKey, onClose, onSubmit }: QuickAddModalProps) {
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState(defaultDateKey);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="calendar-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="quick-add-title" className="calendar-modal-title">
          Quick add note
        </h3>
        <div className="mt-2 grid gap-2">
          <label className="calendar-field-label">
            Task
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="calendar-reminder-input"
              placeholder="Type a quick memo..."
              autoFocus
            />
          </label>
          <label className="calendar-field-label">
            Due date
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="calendar-reminder-input" />
          </label>
        </div>
        <div className="calendar-modal-actions mt-4">
          <button type="button" className="calendar-modal-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="calendar-reminder-add-btn calendar-range-save-btn"
            disabled={!text.trim()}
            onClick={() => {
              if (!text.trim()) return;
              onSubmit({ text: text.trim(), dueDate });
                setText("");
                setDueDate(defaultDateKey);
              onClose();
            }}
          >
            Add note
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
