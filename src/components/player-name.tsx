"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";

/** Matches the team-name affordance, but only edits the modal's local draft. */
export function PlayerName({
  value,
  placeholder,
  label,
  onChange,
}: {
  value: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const beforeFocus = useRef(value);
  const [editing, setEditing] = useState(false);
  return (
    <span className="player-name-editor flex w-max max-w-full items-baseline gap-2">
      <span className="relative grid min-w-[1ch] max-w-full grid-cols-[minmax(0,1fr)]">
        <span
          aria-hidden="true"
          className="invisible min-w-0 overflow-hidden whitespace-pre"
        >
          {value || (editing ? "\u00a0" : placeholder)}
          {"\u200b"}
        </span>
        <input
          type="text"
          value={value}
          maxLength={80}
          aria-label={label}
          title={value || placeholder}
          placeholder={editing ? "" : placeholder}
          spellCheck={false}
          style={{ font: "inherit" }}
          className="absolute inset-0 h-full w-full min-w-0 border-0 bg-transparent p-0 text-ellipsis text-foreground outline-none placeholder:text-muted-foreground"
          onFocus={(event) => {
            beforeFocus.current = value;
            setEditing(true);
            event.currentTarget.select();
          }}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              if (event.key === "Escape") onChange(beforeFocus.current);
              event.currentTarget.blur();
            }
          }}
        />
      </span>
      <Pencil
        aria-hidden="true"
        className="pointer-events-none size-3.5 shrink-0 text-muted-foreground"
      />
    </span>
  );
}
