"use client";
import { useRef, useState } from "react";
import { TEAM_NAME_MAX_LENGTH } from "@/domain/team-name";

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
  const [beforeFocus, setBeforeFocus] = useState(value);
  const cancelled = useRef(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    // A cloud update can arrive while an idle input is focused. Its old buffer
    // must not silently rename the team back on blur or Escape.
    if (editing !== null && editing !== value) {
      setEditing(value);
      setBeforeFocus(value);
    }
  }
  const displayed = editing ?? value;
  return (
    <span className="relative grid w-max min-w-[1ch] max-w-full grid-cols-[minmax(0,1fr)]">
      <span
        aria-hidden="true"
        className="invisible min-w-0 overflow-hidden whitespace-pre py-1"
      >
        {displayed || (editing === null ? placeholder : "\u00a0")}
        {"\u200b"}
      </span>
      <input
        type="text"
        aria-label={label}
        title={value || placeholder}
        value={displayed}
        placeholder={editing === null ? placeholder : ""}
        maxLength={TEAM_NAME_MAX_LENGTH}
        spellCheck={false}
        style={{ font: "inherit" }}
        onFocus={(event) => {
          setBeforeFocus(value);
          cancelled.current = false;
          setEditing(value);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          const next = event.target.value.slice(0, TEAM_NAME_MAX_LENGTH);
          setEditing(next);
          // An empty editing buffer isn't a team rename or a recovery draft.
          if (next.trim()) onChange(next);
        }}
        onBlur={() => {
          if (!cancelled.current) {
            const next = editing?.trim() || beforeFocus;
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
            if (beforeFocus !== value) onChange(beforeFocus);
            event.currentTarget.blur();
          }
        }}
        className="absolute inset-0 h-full w-full min-w-0 overflow-hidden border-0 bg-transparent px-0 py-1 text-ellipsis text-foreground outline-none placeholder:text-muted-foreground focus:text-clip"
      />
    </span>
  );
}
