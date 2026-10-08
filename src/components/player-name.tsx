"use client";

import { useRef, useState } from "react";
import { useTranslations } from "gt-next";
import { Dice5, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { generatePlayerName } from "@/lib/player-name-generator";

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
  const t = useTranslations();
  const beforeFocus = useRef(value);
  const [editing, setEditing] = useState(false);
  return (
    <span
      className="player-name-editor flex w-max max-w-full items-baseline gap-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setEditing(false);
      }}
    >
      <span className="relative grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)]">
        <span
          aria-hidden="true"
          className="invisible min-w-0 overflow-hidden whitespace-pre"
        >
          {value || (editing ? "" : placeholder)}
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
          className="absolute inset-y-0 left-0 h-full w-[calc(100%+0.5rem)] min-w-0 border-0 bg-transparent p-0 text-ellipsis text-foreground outline-none placeholder:text-muted-foreground"
          onFocus={(event) => {
            beforeFocus.current = value;
            setEditing(true);
            event.currentTarget.select();
          }}
          onChange={(event) => onChange(event.target.value)}
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
      <span className="relative inline-flex size-3.5 shrink-0">
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label={t("playerModal.randomizeName")}
            className="absolute left-1/2 top-1/2 inline-flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 after:absolute after:-inset-1.5 sm:after:inset-0"
            onClick={() => onChange(generatePlayerName())}
          >
            <Dice5 aria-hidden="true" className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{t("playerModal.randomizeName")}</TooltipContent>
        </Tooltip>
      </span>
    </span>
  );
}
