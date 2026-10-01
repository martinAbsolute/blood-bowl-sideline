"use client";
import { useRef, useState } from "react";

export function TeamName({
  value,
  placeholder,
  label,
  onChange,
}: {
  value: string;
  placeholder: string;
  label: string;
  onChange: (name: string) => void;
}) {
  const beforeFocus = useRef(value);
  const cancelled = useRef(false);
  const [editing, setEditing] = useState<string | null>(null);
  const displayed = editing ?? value;
  return (
    <span className="relative -left-[9px] grid w-max min-w-[min(12ch,100%)] max-w-full grid-cols-[minmax(0,1fr)]">
      <span
        aria-hidden="true"
        className="invisible min-w-0 whitespace-pre-wrap rounded-md border px-2 py-1"
        style={{ overflowWrap: "anywhere" }}
      >
        {displayed || (editing === null ? placeholder : "\u00a0")}{" "}
      </span>
      <textarea
        aria-label={label}
        value={displayed}
        placeholder={editing === null ? placeholder : ""}
        rows={1}
        maxLength={80}
        spellCheck={false}
        style={{ font: "inherit", overflowWrap: "anywhere" }}
        onFocus={(event) => {
          beforeFocus.current = value;
          cancelled.current = false;
          setEditing(value);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          const next = event.target.value.replace(/[\r\n]+/g, " ");
          setEditing(next);
          // An empty editing buffer isn't a team rename or a recovery draft.
          if (next.trim()) onChange(next);
        }}
        onBlur={() => {
          if (!cancelled.current) {
            const next = editing?.trim() || beforeFocus.current;
            if (next !== value) onChange(next);
          }
          setEditing(null);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelled.current = true;
            if (beforeFocus.current !== value) onChange(beforeFocus.current);
            event.currentTarget.blur();
          }
        }}
        className="absolute inset-0 h-full w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 text-foreground outline-none placeholder:text-muted-foreground"
      />
    </span>
  );
}
