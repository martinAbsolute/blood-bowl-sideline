"use client";
import { useRef } from "react";

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
  return (
    <span className="relative grid w-max min-w-[min(12ch,100%)] max-w-full grid-cols-[minmax(0,1fr)]">
      <span
        aria-hidden="true"
        className="invisible min-w-0 whitespace-pre-wrap rounded-md border px-2 py-1"
        style={{ overflowWrap: "anywhere" }}
      >
        {value || placeholder}{" "}
      </span>
      <textarea
        aria-label={label}
        value={value}
        placeholder={placeholder}
        rows={1}
        maxLength={80}
        spellCheck={false}
        style={{ font: "inherit", overflowWrap: "anywhere" }}
        onFocus={() => {
          beforeFocus.current = value;
          cancelled.current = false;
        }}
        onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
        onBlur={() => {
          if (!cancelled.current && value.trim() !== value)
            onChange(value.trim());
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancelled.current = true;
            onChange(beforeFocus.current);
            e.currentTarget.blur();
          }
        }}
        className="absolute inset-0 h-full w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </span>
  );
}
