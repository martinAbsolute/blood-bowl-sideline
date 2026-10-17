"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { isPlayerNumberAvailable, numberedPlayers } from "@/domain/player-number";
import type { Team } from "@/domain/types";

export function PlayerNumber({
  value,
  label,
  invalid,
  prefix = true,
  onChange,
  onCommit,
}: {
  value: string;
  label: string;
  invalid: boolean;
  prefix?: boolean;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
}) {
  const beforeFocus = useRef(value);
  const cancelled = useRef(false);
  return (
    <span className="inline-flex items-center gap-1 font-mono">
      {prefix && <span aria-hidden="true">#</span>}
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={value}
        aria-label={label}
        aria-invalid={invalid}
        title={label}
        style={{ width: `${Math.max(2, value.length)}ch`, font: "inherit" }}
        className="min-w-0 border-0 bg-transparent p-0 text-foreground outline-none aria-invalid:text-destructive"
        onFocus={(event) => {
          beforeFocus.current = value;
          cancelled.current = false;
          event.currentTarget.select();
        }}
        onBlur={() => {
          if (cancelled.current) return;
          if (invalid) onChange(beforeFocus.current);
          onCommit?.(value);
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Escape") {
              cancelled.current = true;
              onChange(beforeFocus.current);
            }
            event.currentTarget.blur();
          }
        }}
      />
    </span>
  );
}

/** Keep incomplete numbers local; commit valid edits on blur or Enter. */
export function InlinePlayerNumber({
  team,
  playerId,
  onChange,
}: {
  team: Team;
  playerId: string;
  onChange: (team: Team) => void;
}) {
  const t = useTranslations();
  const players = numberedPlayers(team.players);
  const player = players.find((item) => item.id === playerId)!;
  const [draft, setDraft] = useState<string | null>(null);
  const [seenValue, setSeenValue] = useState(player.number);
  if (seenValue !== player.number) {
    setSeenValue(player.number);
    setDraft(null);
  }
  const value = draft ?? player.number;
  const invalid = !isPlayerNumberAvailable(players, playerId, value);
  return (
    <PlayerNumber
      value={value}
      label={t("playerModal.number")}
      invalid={invalid}
      prefix={false}
      onChange={setDraft}
      onCommit={(number) => {
        setDraft(null);
        if (invalid) return;
        if (number === player.number) return;
        onChange({
          ...team,
          players: numberedPlayers(players.map((item) => (item.id === playerId ? { ...item, number } : item))),
        });
      }}
    />
  );
}
