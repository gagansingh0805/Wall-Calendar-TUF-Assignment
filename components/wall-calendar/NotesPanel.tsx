"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type {
  RangeNoteEntry,
  RangeNotePriority,
  RecurrenceFreq,
  RecurringReminderRule,
  SavedRangeNote,
  WeekdayCode,
} from "@/components/wall-calendar/types";
import { normalizeDateKeyRange, parseLocalDateKey, toLocalDateKey } from "@/lib/date";
import type { MemoItem, MemoSortKey } from "@/lib/memo-items";
import { newMemoId, parseMemoItems, serializeMemoItems, sortMemoItems } from "@/lib/memo-items";

type PanelAction = "monthMemo" | "rangeNote" | "recurring" | "holidays";

type CalendarThemeName = "ocean" | "sunset" | "midnight";

type NotesPanelProps = {
  theme: CalendarThemeName;
  monthLabel: string;
  rangeLabel: string;
  monthNote: string;
  rangeNote: RangeNoteEntry;
  activeAction: PanelAction;
  /** Syncs Month Memo “Due” (new item + inline edit) to the current calendar selection. */
  calendarDueDateKey: string | null;
  holidays: Array<{ date: Date; label: string; tier: "major" | "minor" }>;
  currentYearHolidays: Array<{ date: Date; label: string; tier: "major" | "minor" }>;
  onActionChange: (action: PanelAction) => void;
  onMonthNoteChange: (value: string) => void;
  onRangeNoteChange: (patch: Partial<RangeNoteEntry>) => void;
  savedRangeNotes: SavedRangeNote[];
  onSaveRangeNote: (note: RangeNoteEntry) => void;
  onDeleteSavedRangeNote: (id: string) => void;
  onUpdateSavedRangeNote: (id: string, patch: Partial<RangeNoteEntry>) => void;
  reminderDraft: {
    text: string;
    freq: RecurrenceFreq;
    interval: number;
    byMonthDay: string;
    byWeekday: WeekdayCode[];
    count: string;
    until: string;
  };
  reminders: RecurringReminderRule[];
  reminderInstances: Array<{ id: string; text: string; date: Date }>;
  onReminderDraftChange: (patch: Partial<NotesPanelProps["reminderDraft"]>) => void;
  onAddRecurringReminder: () => void;
  onDeleteRecurringReminder: (id: string) => void;
  focusRangeNoteSignal?: number;
};

type MemoEditDraft = Pick<MemoItem, "id" | "text" | "priority" | "dueDate" | "addedDate">;

function MemoIconPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function MemoIconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function MemoIconReopen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 6 6v7" />
    </svg>
  );
}

function formatDateKeyDisplay(key: string) {
  const d = parseLocalDateKey(key);
  if (!d) return key;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function memoPriorityLabel(priority: RangeNotePriority): string {
  if (priority === "low") return "Low";
  if (priority === "high") return "High";
  return "Medium";
}

function MemoItemDateMeta({ item }: { item: MemoItem }) {
  return (
    <div className="calendar-memo-item-meta items-start">
      <span className={`calendar-priority-pill priority-${item.priority}`}>{memoPriorityLabel(item.priority)}</span>
      <div className="flex min-w-0 flex-col gap-0.5 text-[10px] leading-snug">
        {item.addedDate ? (
          <div className="flex flex-wrap items-baseline gap-x-1">
            <span className="calendar-muted">Added</span>
            <span className="calendar-memo-due font-semibold">{formatDateKeyDisplay(item.addedDate)}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-1">
          <span className="calendar-muted">Due</span>
          {item.dueDate ? (
            <span className="calendar-memo-due font-semibold">{formatDateKeyDisplay(item.dueDate)}</span>
          ) : (
            <span className="calendar-muted">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MonthMemoInlineEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  ariaLabel,
}: {
  draft: MemoEditDraft;
  setDraft: Dispatch<SetStateAction<MemoEditDraft | null>>;
  onSave: () => void;
  onCancel: () => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="calendar-memo-edit-panel w-full"
      role="group"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="space-y-2">
        <label className="calendar-field-label">
          Task
          <input
            value={draft.text}
            onChange={(event) => setDraft((d) => (d ? { ...d, text: event.target.value } : d))}
            className="calendar-reminder-input w-full min-w-0"
            aria-label="Memo task text"
          />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="calendar-field-label min-w-0">
            Priority
            <select
              value={draft.priority}
              onChange={(event) =>
                setDraft((d) => (d ? { ...d, priority: event.target.value as RangeNotePriority } : d))
              }
              className="calendar-reminder-input w-full"
              aria-label="Memo priority"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="calendar-field-label min-w-0">
            Due (optional)
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft((d) => (d ? { ...d, dueDate: event.target.value } : d))}
              className="calendar-reminder-input w-full"
              aria-label="Memo due date"
            />
          </label>
        </div>
        {draft.addedDate ? (
          <p className="calendar-muted text-[11px]">
            Added{" "}
            <span className="calendar-text font-medium">{formatDateKeyDisplay(draft.addedDate)}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            className="calendar-reminder-add-btn calendar-range-save-btn min-h-[2.35rem] px-5 py-2 text-xs"
            disabled={!draft.text.trim()}
            onClick={onSave}
          >
            Save changes
          </button>
          <button type="button" className="calendar-link-btn text-xs" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function savedNoteToEntryFields(note: SavedRangeNote): RangeNoteEntry {
  return {
    fromDate: note.fromDate,
    toDate: note.toDate,
    title: note.title,
    description: note.description,
    tag: note.tag,
    priority: note.priority,
  };
}

export function NotesPanel({
  theme,
  monthLabel,
  rangeLabel,
  monthNote,
  rangeNote,
  activeAction,
  calendarDueDateKey,
  holidays,
  currentYearHolidays,
  onActionChange,
  onMonthNoteChange,
  onRangeNoteChange,
  savedRangeNotes,
  onSaveRangeNote,
  onDeleteSavedRangeNote,
  onUpdateSavedRangeNote,
  reminderDraft,
  reminders,
  reminderInstances,
  onReminderDraftChange,
  onAddRecurringReminder,
  onDeleteRecurringReminder,
  focusRangeNoteSignal = 0,
}: NotesPanelProps) {
  const rangeNoteTitleRef = useRef<HTMLInputElement | null>(null);
  const monthNoteRef = useRef<HTMLInputElement | null>(null);
  const [memoPrompt, setMemoPrompt] = useState("");
  const [memoDraftPriority, setMemoDraftPriority] = useState<RangeNotePriority>("medium");
  const [memoDraftDueDate, setMemoDraftDueDate] = useState("");
  const [memoSort, setMemoSort] = useState<MemoSortKey>("order");
  /** Inline edit for month memo list items (view → edit → save/cancel). */
  const [memoEdit, setMemoEdit] = useState<MemoEditDraft | null>(null);
  const [modalSavedNote, setModalSavedNote] = useState<SavedRangeNote | null>(null);
  const [isEditingSavedModal, setIsEditingSavedModal] = useState(false);
  const [savedNoteEditDraft, setSavedNoteEditDraft] = useState<RangeNoteEntry>({
    fromDate: "",
    toDate: "",
    title: "",
    description: "",
    tag: "",
    priority: "medium",
  });
  const [portalMounted, setPortalMounted] = useState(false);
  const isWeekly = reminderDraft.freq === "weekly";
  const isMonthly = reminderDraft.freq === "monthly";
  const memoItems = useMemo(() => parseMemoItems(monthNote), [monthNote]);
  const pendingItems = useMemo(
    () => sortMemoItems(memoItems.filter((item) => !item.done), memoSort),
    [memoItems, memoSort],
  );
  const completedItems = useMemo(
    () => sortMemoItems(memoItems.filter((item) => item.done), memoSort),
    [memoItems, memoSort],
  );

  const closeSavedNoteModal = useCallback(() => {
    setModalSavedNote(null);
    setIsEditingSavedModal(false);
  }, []);

  // Portal target is document.body; enable only after hydration to match SSR.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount gate for createPortal
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!modalSavedNote) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSavedNoteModal();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [modalSavedNote, closeSavedNoteModal]);

  const canSaveRangeNote = Boolean(
    rangeNote.fromDate?.trim() && rangeNote.toDate?.trim() && rangeNote.title?.trim(),
  );
  const canAddMemo = Boolean(memoPrompt.trim());
  const canAddRecurring = Boolean(reminderDraft.text.trim());

  useEffect(() => {
    if (!focusRangeNoteSignal) return;
    onActionChange("rangeNote");
    rangeNoteTitleRef.current?.focus();
  }, [focusRangeNoteSignal, onActionChange]);

  useEffect(() => {
    if (activeAction !== "monthMemo") setMemoEdit(null);
  }, [activeAction]);

  useEffect(() => {
    if (!calendarDueDateKey?.trim()) return;
    setMemoDraftDueDate(calendarDueDateKey);
    setMemoEdit((prev) => (prev ? { ...prev, dueDate: calendarDueDateKey } : prev));
  }, [calendarDueDateKey]);

  function beginMemoEdit(item: MemoItem) {
    setMemoEdit({
      id: item.id,
      text: item.text,
      priority: item.priority,
      dueDate: item.dueDate,
      addedDate: item.addedDate,
    });
  }

  function saveMemoEdit() {
    if (!memoEdit) return;
    const text = memoEdit.text.trim();
    if (!text) return;
    patchMemoItem(memoEdit.id, {
      text,
      priority: memoEdit.priority,
      dueDate: memoEdit.dueDate.trim(),
    });
    setMemoEdit(null);
  }

  function cancelMemoEdit() {
    setMemoEdit(null);
  }

  function addMemoFromPrompt() {
    const value = memoPrompt.trim();
    if (!value) return;
    const nextItems: MemoItem[] = [
      ...memoItems,
      {
        id: newMemoId(),
        text: value,
        done: false,
        priority: memoDraftPriority,
        dueDate: memoDraftDueDate.trim(),
        addedDate: toLocalDateKey(new Date()),
      },
    ];
    onMonthNoteChange(serializeMemoItems(nextItems));
    setMemoPrompt("");
  }

  function toggleMemoStatus(id: string) {
    onMonthNoteChange(
      serializeMemoItems(memoItems.map((item) => (item.id === id ? { ...item, done: !item.done } : item))),
    );
  }

  function removeMemoItem(id: string) {
    setMemoEdit((prev) => (prev?.id === id ? null : prev));
    onMonthNoteChange(serializeMemoItems(memoItems.filter((item) => item.id !== id)));
  }

  function patchMemoItem(id: string, patch: Partial<Pick<MemoItem, "text" | "priority" | "dueDate">>) {
    onMonthNoteChange(
      serializeMemoItems(memoItems.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    );
  }

  function clearCompletedMemos() {
    const nextItems = memoItems.filter((item) => !item.done);
    onMonthNoteChange(serializeMemoItems(nextItems));
  }

  function onSaveSavedNoteEdits() {
    if (!modalSavedNote) return;
    if (!savedNoteEditDraft.title.trim()) return;
    const from = savedNoteEditDraft.fromDate.trim();
    const to = savedNoteEditDraft.toDate.trim();
    if (!from || !to) return;
    const normalized = normalizeDateKeyRange(from, to);
    onUpdateSavedRangeNote(modalSavedNote.id, savedNoteEditDraft);
    setModalSavedNote((prev) =>
      prev
        ? {
            ...prev,
            ...savedNoteEditDraft,
            fromDate: normalized.fromDate,
            toDate: normalized.toDate,
          }
        : null,
    );
    setIsEditingSavedModal(false);
  }

  function onCancelSavedNoteEdits() {
    if (!modalSavedNote) return;
    setSavedNoteEditDraft(savedNoteToEntryFields(modalSavedNote));
    setIsEditingSavedModal(false);
  }

  const canSaveSavedEdits = Boolean(
    savedNoteEditDraft.title?.trim() && savedNoteEditDraft.fromDate?.trim() && savedNoteEditDraft.toDate?.trim(),
  );

  const modal =
    portalMounted && modalSavedNote
      ? createPortal(
          <div className="calendar-modal-backdrop" role="presentation" onClick={closeSavedNoteModal}>
            <div
              className="calendar-sheet calendar-modal-theme-bridge"
              data-theme={theme}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="calendar-modal-dialog calendar-modal-dialog-saved-range"
                role="dialog"
                aria-modal="true"
                aria-labelledby="saved-range-note-title"
              >
                {isEditingSavedModal ? (
                  <>
                    <h4 id="saved-range-note-title" className="calendar-modal-title">
                      Edit saved note
                    </h4>
                    <div className="calendar-modal-edit-grid">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="calendar-field-label calendar-modal-field-label">
                          From
                          <input
                            type="date"
                            value={savedNoteEditDraft.fromDate}
                            onChange={(event) => setSavedNoteEditDraft((d) => ({ ...d, fromDate: event.target.value }))}
                            className="calendar-reminder-input"
                            aria-label="From date"
                          />
                        </label>
                        <label className="calendar-field-label calendar-modal-field-label">
                          To
                          <input
                            type="date"
                            value={savedNoteEditDraft.toDate}
                            onChange={(event) => setSavedNoteEditDraft((d) => ({ ...d, toDate: event.target.value }))}
                            className="calendar-reminder-input"
                            aria-label="To date"
                          />
                        </label>
                      </div>
                      <label className="calendar-field-label calendar-modal-field-label">
                        Title
                        <input
                          value={savedNoteEditDraft.title}
                          onChange={(event) => setSavedNoteEditDraft((d) => ({ ...d, title: event.target.value }))}
                          className="calendar-reminder-input"
                        />
                      </label>
                      <label className="calendar-field-label calendar-modal-field-label">
                        Description
                        <textarea
                          value={savedNoteEditDraft.description}
                          onChange={(event) => setSavedNoteEditDraft((d) => ({ ...d, description: event.target.value }))}
                          className="calendar-notes-area min-h-[7rem]"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="calendar-field-label calendar-modal-field-label">
                          Tag
                          <input
                            value={savedNoteEditDraft.tag}
                            onChange={(event) => setSavedNoteEditDraft((d) => ({ ...d, tag: event.target.value }))}
                            className="calendar-reminder-input"
                          />
                        </label>
                        <label className="calendar-field-label calendar-modal-field-label">
                          Priority
                          <select
                            value={savedNoteEditDraft.priority}
                            onChange={(event) =>
                              setSavedNoteEditDraft((d) => ({ ...d, priority: event.target.value as RangeNotePriority }))
                            }
                            className="calendar-reminder-input"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="calendar-modal-actions calendar-modal-actions-split">
                      <button type="button" className="calendar-modal-secondary-btn" onClick={onCancelSavedNoteEdits}>
                        Cancel
                      </button>
                      <div className="calendar-modal-actions-end">
                        <button
                          type="button"
                          className="calendar-modal-delete-btn"
                          onClick={() => {
                            onDeleteSavedRangeNote(modalSavedNote.id);
                            closeSavedNoteModal();
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="calendar-modal-save-edit-btn"
                          disabled={!canSaveSavedEdits}
                          onClick={onSaveSavedNoteEdits}
                        >
                          Save changes
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 id="saved-range-note-title" className="calendar-modal-title">
                      {modalSavedNote.title.trim() || "Untitled"}
                    </h4>
                    <p className="calendar-modal-dates">{formatDateKeyDisplay(modalSavedNote.fromDate)} → {formatDateKeyDisplay(modalSavedNote.toDate)}</p>
                    {modalSavedNote.tag.trim() ? (
                      <p className="calendar-modal-tag">
                        <span className="calendar-modal-kicker">Tag</span> {modalSavedNote.tag}
                      </p>
                    ) : null}
                    <p className="calendar-modal-priority">
                      <span className={`calendar-priority-pill calendar-modal-priority-pill priority-${modalSavedNote.priority}`}>
                        {modalSavedNote.priority}
                      </span>
                    </p>
                    <div className="calendar-modal-body">
                      <p className="calendar-modal-kicker mb-1">Description</p>
                      {modalSavedNote.description.trim() ? (
                        <p className="calendar-modal-description-text whitespace-pre-wrap">{modalSavedNote.description}</p>
                      ) : (
                        <p className="calendar-modal-empty-hint">No description.</p>
                      )}
                    </div>
                    <div className="calendar-modal-actions calendar-modal-actions-split">
                      <button type="button" className="calendar-modal-secondary-btn" onClick={() => setIsEditingSavedModal(true)}>
                        Edit
                      </button>
                      <div className="calendar-modal-actions-end">
                        <button type="button" className="calendar-modal-close-btn" onClick={closeSavedNoteModal}>
                          Close
                        </button>
                        <button
                          type="button"
                          className="calendar-modal-delete-btn"
                          onClick={() => {
                            onDeleteSavedRangeNote(modalSavedNote.id);
                            closeSavedNoteModal();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {modal}
      <aside className="calendar-panel calendar-notes-clean flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
      <div>
        <h3 className="calendar-muted text-[11px] font-semibold tracking-wide">Notes</h3>
        <p className="calendar-muted mt-1 text-xs">{monthLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            { id: "monthMemo", label: "Month Memo" },
            { id: "rangeNote", label: "Range Note" },
            { id: "recurring", label: "Recurring" },
            { id: "holidays", label: "Holidays" },
          ] as Array<{ id: PanelAction; label: string }>
        ).map((action) => (
          <button
            key={action.id}
            type="button"
            className={`calendar-action-btn ${activeAction === action.id ? "is-active" : ""}`}
            onClick={() => onActionChange(action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>

      {activeAction === "monthMemo" ? (
        <div className="calendar-mini-sheet">
          <div className="calendar-memo-add space-y-3">
            <label className="calendar-field-label">
              Task
              <input
                ref={monthNoteRef}
                value={memoPrompt}
                onChange={(event) => setMemoPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addMemoFromPrompt();
                  }
                }}
                className="calendar-reminder-input w-full min-w-0"
                placeholder="What do you need to do this month?"
                aria-label="New memo task"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
              <label className="calendar-field-label min-w-0">
                Priority
                <select
                  value={memoDraftPriority}
                  onChange={(event) => setMemoDraftPriority(event.target.value as RangeNotePriority)}
                  className="calendar-reminder-input w-full"
                  aria-label="Priority for new memo"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="calendar-field-label min-w-0">
                Due (optional)
                <input
                  type="date"
                  value={memoDraftDueDate}
                  onChange={(event) => setMemoDraftDueDate(event.target.value)}
                  className="calendar-reminder-input w-full"
                  aria-label="Due date for new memo"
                />
              </label>
            </div>
            <div className="pt-0.5">
              <button
                type="button"
                className="calendar-reminder-add-btn calendar-range-save-btn min-h-[2.45rem] w-full px-5 py-2.5 text-sm"
                disabled={!canAddMemo}
                onClick={addMemoFromPrompt}
                aria-disabled={!canAddMemo}
              >
                Add to list
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4 border-t border-[color:var(--theme-panel-border)] pt-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="calendar-field-label mb-0">Pending</p>
                <label className="calendar-field-label mb-0 flex items-center gap-2 !flex-row">
                  <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-[color:var(--theme-muted)]">Sort</span>
                  <select
                    value={memoSort}
                    onChange={(event) => setMemoSort(event.target.value as MemoSortKey)}
                    className="calendar-reminder-input !w-auto min-w-[9rem] py-1.5 text-xs"
                    aria-label="Sort memos"
                  >
                    <option value="order">List order</option>
                    <option value="dueDate">Due date</option>
                    <option value="priority">Priority</option>
                    <option value="alpha">Alphabetical</option>
                  </select>
                </label>
              </div>
              {pendingItems.length === 0 ? (
                <p className="calendar-muted text-xs">No pending items.</p>
              ) : (
                <ol className="space-y-2">
                  {pendingItems.map((item, index) => {
                    const isEditing = memoEdit?.id === item.id;
                    return (
                      <li
                        key={item.id}
                        className={`calendar-memo-item-row ${isEditing ? "calendar-memo-item-row--editing" : ""}`}
                      >
                        {isEditing && memoEdit ? (
                          <MonthMemoInlineEditor
                            draft={memoEdit}
                            setDraft={setMemoEdit}
                            onSave={saveMemoEdit}
                            onCancel={cancelMemoEdit}
                            ariaLabel={`Edit memo ${index + 1}`}
                          />
                        ) : (
                          <>
                            <div className="calendar-memo-item-stack">
                              <p className="calendar-memo-item-title">
                                <span className="calendar-memo-item-index">{index + 1}.</span>
                                <span>{item.text}</span>
                              </p>
                              <MemoItemDateMeta item={item} />
                            </div>
                            <div className="calendar-memo-item-actions">
                              <button
                                type="button"
                                className="calendar-link-btn calendar-memo-icon-btn"
                                onClick={() => beginMemoEdit(item)}
                                aria-label={`Edit: ${item.text}`}
                                title="Edit"
                              >
                                <MemoIconPencil />
                              </button>
                              <button
                                type="button"
                                className="calendar-link-btn calendar-memo-icon-btn"
                                onClick={() => toggleMemoStatus(item.id)}
                                aria-label={`Mark done: ${item.text}`}
                                title="Mark done"
                              >
                                <MemoIconCheck />
                              </button>
                              <button
                                type="button"
                                className="calendar-memo-delete-btn"
                                onClick={() => removeMemoItem(item.id)}
                                aria-label={`Remove pending item: ${item.text}`}
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="calendar-field-label mb-0">Completed</p>
                {completedItems.length > 0 ? (
                  <button type="button" className="calendar-link-btn text-xs" onClick={clearCompletedMemos} aria-label="Clear all completed items">
                    Clear list
                  </button>
                ) : null}
              </div>
              {completedItems.length === 0 ? (
                <p className="calendar-muted text-xs">No completed items yet.</p>
              ) : (
                <ol className="space-y-2">
                  {completedItems.map((item, index) => {
                    const isEditing = memoEdit?.id === item.id;
                    return (
                      <li
                        key={item.id}
                        className={`calendar-memo-item-row calendar-memo-item-row--done ${isEditing ? "calendar-memo-item-row--editing" : ""}`}
                      >
                        {isEditing && memoEdit ? (
                          <MonthMemoInlineEditor
                            draft={memoEdit}
                            setDraft={setMemoEdit}
                            onSave={saveMemoEdit}
                            onCancel={cancelMemoEdit}
                            ariaLabel={`Edit memo ${index + 1}`}
                          />
                        ) : (
                          <>
                            <div className="calendar-memo-item-stack">
                              <p className="calendar-memo-item-title calendar-memo-item-title--done">
                                <span className="calendar-memo-item-index">{index + 1}.</span>
                                <span>{item.text}</span>
                              </p>
                              <MemoItemDateMeta item={item} />
                            </div>
                            <div className="calendar-memo-item-actions">
                              <button
                                type="button"
                                className="calendar-link-btn calendar-memo-icon-btn"
                                onClick={() => beginMemoEdit(item)}
                                aria-label={`Edit: ${item.text}`}
                                title="Edit"
                              >
                                <MemoIconPencil />
                              </button>
                              <button
                                type="button"
                                className="calendar-link-btn calendar-memo-icon-btn"
                                onClick={() => toggleMemoStatus(item.id)}
                                aria-label={`Reopen: ${item.text}`}
                                title="Reopen"
                              >
                                <MemoIconReopen />
                              </button>
                              <button
                                type="button"
                                className="calendar-memo-delete-btn"
                                onClick={() => removeMemoItem(item.id)}
                                aria-label={`Remove completed item: ${item.text}`}
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeAction === "rangeNote" ? (
        <div className="calendar-mini-sheet">
          <p className="calendar-text mb-2 text-[11px] font-medium uppercase tracking-wide">Range ({rangeLabel})</p>
          <div className="grid gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <label className="calendar-field-label">
                From
                <input
                  type="date"
                  value={rangeNote.fromDate}
                  onChange={(event) => onRangeNoteChange({ fromDate: event.target.value })}
                  className="calendar-reminder-input"
                  aria-label="Range note from date"
                />
              </label>
              <label className="calendar-field-label">
                To
                <input
                  type="date"
                  value={rangeNote.toDate}
                  onChange={(event) => onRangeNoteChange({ toDate: event.target.value })}
                  className="calendar-reminder-input"
                  aria-label="Range note to date"
                />
              </label>
            </div>
            <p className="calendar-range-note-hint">
              Select or drag on the calendar to set dates; they sync to From and To above.
            </p>
            <label className="calendar-field-label">
              Title
              <input
                ref={rangeNoteTitleRef}
                value={rangeNote.title}
                onChange={(event) => onRangeNoteChange({ title: event.target.value })}
                placeholder="Ex: Goa trip"
                className="calendar-reminder-input"
              />
            </label>
            <label className="calendar-field-label">
              Description
              <textarea
                value={rangeNote.description}
                onChange={(event) => onRangeNoteChange({ description: event.target.value })}
                className="calendar-notes-area min-h-24"
                placeholder="Add details for this selected range..."
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="calendar-field-label">
                Tag / Badge
                <input
                  value={rangeNote.tag}
                  onChange={(event) => onRangeNoteChange({ tag: event.target.value })}
                  placeholder="Trip, Exam, Sprint..."
                  className="calendar-reminder-input"
                />
              </label>
              <label className="calendar-field-label">
                Priority
                <select
                  value={rangeNote.priority}
                  onChange={(event) => onRangeNoteChange({ priority: event.target.value as RangeNotePriority })}
                  className="calendar-reminder-input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              className="calendar-reminder-add-btn calendar-range-save-btn"
              disabled={!canSaveRangeNote}
              onClick={() => onSaveRangeNote(rangeNote)}
              aria-disabled={!canSaveRangeNote}
            >
              Save to list
            </button>
            <div>
              <p className="calendar-field-label mb-1.5">Saved for this month</p>
              {savedRangeNotes.length === 0 ? (
                <p className="calendar-muted text-xs">No saved range notes yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {savedRangeNotes.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="calendar-saved-range-row"
                        onClick={() => {
                          setModalSavedNote(item);
                          setSavedNoteEditDraft(savedNoteToEntryFields(item));
                          setIsEditingSavedModal(false);
                        }}
                        aria-label={`View saved note ${item.title.trim() || "Untitled"}`}
                      >
                        <span className="calendar-saved-range-row-title">{item.title.trim() || "Untitled"}</span>
                        <span className="calendar-saved-range-row-meta">
                          {formatDateKeyDisplay(item.fromDate)} – {formatDateKeyDisplay(item.toDate)}
                        </span>
                        <span className={`calendar-priority-pill priority-${item.priority}`}>{item.priority}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeAction === "recurring" ? (
        <div className="calendar-mini-sheet">
          <div className="flex items-center justify-between gap-2">
            <p className="calendar-subtle text-[11px] font-medium uppercase tracking-wide">Recurring reminders</p>
            <span className="calendar-muted text-[10px]">Rule builder</span>
          </div>
          <div className="mt-2 grid gap-2">
            <label className="calendar-field-label">
              Reminder
              <input
                value={reminderDraft.text}
                onChange={(event) => onReminderDraftChange({ text: event.target.value })}
                placeholder="Ex: Pay electricity bill"
                className="calendar-reminder-input"
                aria-label="Reminder text"
              />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="calendar-field-label">
                Frequency
                <select
                  aria-label="Recurrence frequency"
                  value={reminderDraft.freq}
                  onChange={(event) => onReminderDraftChange({ freq: event.target.value as RecurrenceFreq })}
                  className="calendar-reminder-input"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="calendar-field-label">
                Every
                <input
                  value={reminderDraft.interval}
                  onChange={(event) => onReminderDraftChange({ interval: Math.max(1, Number(event.target.value) || 1) })}
                  type="number"
                  min={1}
                  className="calendar-reminder-input w-20"
                  aria-label="Interval"
                />
              </label>
            </div>
            {isMonthly ? (
              <label className="calendar-field-label">
                Month days
                <input
                  value={reminderDraft.byMonthDay}
                  onChange={(event) => onReminderDraftChange({ byMonthDay: event.target.value })}
                  placeholder="12 or 12,28"
                  className="calendar-reminder-input"
                  aria-label="Monthly days"
                />
              </label>
            ) : null}
            {isWeekly ? (
              <div>
                <p className="calendar-field-label mb-1">Weekdays</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as WeekdayCode[]).map((day) => {
                    const active = reminderDraft.byWeekday.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`calendar-chip ${active ? "calendar-chip-active" : ""}`}
                        onClick={() =>
                          onReminderDraftChange({
                            byWeekday: active ? reminderDraft.byWeekday.filter((item) => item !== day) : [...reminderDraft.byWeekday, day],
                          })
                        }
                        aria-pressed={active}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <label className="calendar-field-label">
                Ends on
                <input
                  value={reminderDraft.until}
                  onChange={(event) => onReminderDraftChange({ until: event.target.value })}
                  type="date"
                  className="calendar-reminder-input"
                  aria-label="Until date"
                />
              </label>
              <label className="calendar-field-label">
                Or after count
                <input
                  value={reminderDraft.count}
                  onChange={(event) => onReminderDraftChange({ count: event.target.value })}
                  placeholder="Optional"
                  className="calendar-reminder-input"
                  aria-label="Repeat count"
                />
              </label>
            </div>
            <button
              type="button"
              className="calendar-reminder-add-btn"
              disabled={!canAddRecurring}
              onClick={onAddRecurringReminder}
              aria-disabled={!canAddRecurring}
            >
              Add recurring
            </button>
          </div>
          {reminders.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="calendar-reminder-row">
                  <span className="calendar-text text-xs">{reminder.text}</span>
                  <button type="button" className="calendar-link-btn text-xs" onClick={() => onDeleteRecurringReminder(reminder.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {reminderInstances.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {reminderInstances.slice(0, 6).map((item) => (
                <li key={`${item.id}-${item.date.toISOString()}`} className="calendar-reminder-instance">
                  {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(item.date)} - {item.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="calendar-muted mt-2 text-xs">No reminder occurrences for this month.</p>
          )}
        </div>
      ) : null}

      {activeAction === "holidays" ? (
        <>
          <div className="calendar-mini-sheet calendar-holidays-sheet">
            <div className="calendar-holidays-sheet-head">
              <p className="calendar-holidays-sheet-title">Holidays this month</p>
              {holidays.length > 0 ? (
                <span className="calendar-holidays-count">{holidays.length}</span>
              ) : null}
            </div>
            {holidays.length === 0 ? (
              <p className="calendar-holidays-empty">No public or observance holidays listed for this month.</p>
            ) : (
              <ul className="calendar-holidays-list" role="list">
                {holidays.map((holiday) => (
                  <li key={`${holiday.label}-${holiday.date.toISOString()}`} className={`calendar-holiday-row ${holiday.tier}`}>
                    <time className="calendar-holiday-date-badge" dateTime={holiday.date.toISOString().slice(0, 10)}>
                      <span className="calendar-holiday-date-day">{holiday.date.getDate()}</span>
                      <span className="calendar-holiday-date-mon">
                        {new Intl.DateTimeFormat("en-US", { month: "short" }).format(holiday.date)}
                      </span>
                    </time>
                    <div className="calendar-holiday-body">
                      <span className="calendar-holiday-name">{holiday.label}</span>
                      <span className={`calendar-holiday-tier ${holiday.tier}`}>
                        {holiday.tier === "major" ? "Major" : "Observance"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <details className="calendar-mini-sheet calendar-holidays-year-details">
            <summary className="calendar-holidays-year-summary">
              <span className="calendar-holidays-year-summary-label">All Indian holidays this year</span>
              {currentYearHolidays.length > 0 ? (
                <span className="calendar-holidays-count calendar-holidays-count-muted">{currentYearHolidays.length}</span>
              ) : null}
            </summary>
            {currentYearHolidays.length === 0 ? (
              <p className="calendar-holidays-empty">No holidays loaded for this year yet.</p>
            ) : (
              <ul className="calendar-holidays-list calendar-holidays-list-scroll" role="list">
                {currentYearHolidays.map((holiday) => (
                  <li key={`${holiday.label}-${holiday.date.toISOString()}`} className={`calendar-holiday-row ${holiday.tier}`}>
                    <time className="calendar-holiday-date-badge" dateTime={holiday.date.toISOString().slice(0, 10)}>
                      <span className="calendar-holiday-date-day">{holiday.date.getDate()}</span>
                      <span className="calendar-holiday-date-mon">
                        {new Intl.DateTimeFormat("en-US", { month: "short" }).format(holiday.date)}
                      </span>
                    </time>
                    <div className="calendar-holiday-body">
                      <span className="calendar-holiday-name">{holiday.label}</span>
                      <span className={`calendar-holiday-tier ${holiday.tier}`}>
                        {holiday.tier === "major" ? "Major" : "Observance"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </>
      ) : null}
    </aside>
    </>
  );
}
