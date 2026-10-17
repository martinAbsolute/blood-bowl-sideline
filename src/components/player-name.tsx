"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Dice5, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { hasPlayerName, PLAYER_NAME_MAX_LENGTH } from "@/domain/player-name";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  return (
    <span
      className="player-name-editor flex w-max max-w-full items-baseline gap-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setEditing(false);
      }}
    >
      <span className="relative grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)]">
        <span aria-hidden="true" className="invisible min-w-0 overflow-hidden whitespace-pre">
          {value || (editing ? "" : placeholder)}
          {"\u200b"}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={PLAYER_NAME_MAX_LENGTH}
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
          onChange={(event) => onChange(event.target.value.slice(0, PLAYER_NAME_MAX_LENGTH))}
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
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={t("playerModal.editName")}
          className="inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => inputRef.current?.focus()}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{t("playerModal.editName")}</TooltipContent>
      </Tooltip>
      <span className="relative inline-flex size-3.5 shrink-0">
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label={t("playerModal.randomizeName")}
            className="absolute left-1/2 top-1/2 inline-flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 after:absolute after:-inset-1.5 sm:after:inset-0"
            onClick={() => onChange(generatePlayerName().slice(0, PLAYER_NAME_MAX_LENGTH))}
          >
            <Dice5 aria-hidden="true" className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{t("playerModal.randomizeName")}</TooltipContent>
        </Tooltip>
      </span>
    </span>
  );
}

/** A quiet table editor; complete edits commit on blur or Enter. */
export function InlinePlayerName({
  value,
  designation,
  label,
  onChange,
}: {
  value: string;
  designation: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [seenValue, setSeenValue] = useState(value);
  const cancelled = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectOnFocus = useRef(false);
  useLayoutEffect(() => {
    if (selectOnFocus.current) {
      inputRef.current?.select();
      selectOnFocus.current = false;
    }
  }, [draft]);
  if (seenValue !== value) {
    setSeenValue(value);
    setDraft(null);
  }
  const displayed = draft ?? value;
  return (
    <div className="flex h-8 min-w-0 max-w-full flex-col justify-center">
      <span className="relative grid w-max min-w-[1ch] max-w-full grid-cols-[minmax(0,1fr)] text-sm font-semibold leading-5">
        <span aria-hidden="true" className="invisible min-w-0 overflow-hidden whitespace-pre">
          {displayed || designation}
          {"\u200b"}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={displayed}
          placeholder={draft === null ? designation : ""}
          maxLength={PLAYER_NAME_MAX_LENGTH}
          aria-label={label}
          title={value || designation}
          spellCheck={false}
          style={{ font: "inherit" }}
          className="absolute inset-0 h-full w-full min-w-0 border-0 bg-transparent p-0 text-ellipsis text-foreground outline-none placeholder:text-foreground focus:text-clip"
          onFocus={() => {
            cancelled.current = false;
            selectOnFocus.current = true;
            setDraft(value || designation);
          }}
          onChange={(event) => setDraft(event.target.value.slice(0, PLAYER_NAME_MAX_LENGTH))}
          onBlur={() => {
            if (!cancelled.current && draft !== null) {
              const name = draft.trim() === designation ? "" : draft.trim();
              if (name !== value) onChange(name);
            }
            setDraft(null);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              if (event.key === "Escape") cancelled.current = true;
              event.currentTarget.blur();
            }
          }}
        />
      </span>
      {hasPlayerName(value, designation) && <p className="text-xs leading-3 text-muted-foreground">{designation}</p>}
    </div>
  );
}
