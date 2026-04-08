import type { RangeNotePriority } from "@/components/wall-calendar/types";
import { parseLocalDateKey } from "@/lib/date";

export type MemoItem = {
  id: string;
  text: string;
  done: boolean;
  priority: RangeNotePriority;
  /** YYYY-MM-DD or empty */
  dueDate: string;
  /** YYYY-MM-DD when the item was created (optional for legacy lines) */
  addedDate: string;
};

export type MemoSortKey = "order" | "dueDate" | "priority" | "alpha";

export function newMemoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `memo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Stable id for legacy lines until first serialize upgrades storage. */
function legacyMemoId(line: string, index: number): string {
  let h = 0;
  const s = `${index}:${line}`;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `legacy-${index}-${Math.abs(h).toString(36)}`;
}

function parseMemoLine(line: string, index: number): MemoItem | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const structured = trimmed.match(
    /^\[(x| )\]\s*\|id:([^|]+)\|p:(low|medium|high)\|(?:d:([^|]+)\|)?(?:a:([^|]+)\|)?([\s\S]*)$/,
  );
  if (structured) {
    return {
      id: structured[2],
      done: structured[1] === "x",
      priority: structured[3] as RangeNotePriority,
      dueDate: (structured[4] ?? "").trim(),
      addedDate: (structured[5] ?? "").trim(),
      text: (structured[6] ?? "").trim(),
    };
  }

  if (trimmed.startsWith("[x] ")) {
    return {
      id: legacyMemoId(trimmed, index),
      text: trimmed.slice(4).trim(),
      done: true,
      priority: "medium",
      dueDate: "",
      addedDate: "",
    };
  }
  if (trimmed.startsWith("[ ] ")) {
    return {
      id: legacyMemoId(trimmed, index),
      text: trimmed.slice(4).trim(),
      done: false,
      priority: "medium",
      dueDate: "",
      addedDate: "",
    };
  }
  return {
    id: legacyMemoId(trimmed, index),
    text: trimmed,
    done: false,
    priority: "medium",
    dueDate: "",
    addedDate: "",
  };
}

export function parseMemoItems(value: string): MemoItem[] {
  return value
    .split("\n")
    .map((line, index) => parseMemoLine(line, index))
    .filter((item): item is MemoItem => item !== null);
}

function serializeMemoLine(item: MemoItem): string {
  const prefix = item.done ? "[x]" : "[ ]";
  const dPart = item.dueDate.trim() ? `d:${item.dueDate.trim()}|` : "";
  const aPart = item.addedDate.trim() ? `a:${item.addedDate.trim()}|` : "";
  return `${prefix} |id:${item.id}|p:${item.priority}|${dPart}${aPart}${item.text}`;
}

export function serializeMemoItems(items: MemoItem[]): string {
  return items.map(serializeMemoLine).join("\n");
}

export function sortMemoItems(items: MemoItem[], sort: MemoSortKey): MemoItem[] {
  if (sort === "order") return items;
  const copy = [...items];
  const priorityRank = (p: RangeNotePriority) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
  const dueTime = (d: string) => {
    const t = parseLocalDateKey(d.trim());
    return t ? t.getTime() : Number.MAX_SAFE_INTEGER;
  };
  copy.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "dueDate":
        cmp = dueTime(a.dueDate) - dueTime(b.dueDate);
        break;
      case "priority":
        cmp = priorityRank(a.priority) - priorityRank(b.priority);
        break;
      case "alpha":
        cmp = a.text.localeCompare(b.text, undefined, { sensitivity: "base" });
        break;
      default:
        cmp = 0;
    }
    if (cmp !== 0) return cmp;
    return a.text.localeCompare(b.text, undefined, { sensitivity: "base" });
  });
  return copy;
}
