import { getRoster, stars } from "@/domain/catalog";
import type { Team } from "@/domain/types";
import { numberedPlayers } from "@/domain/player-number";
import { PlayerIcon, StarPlayerIcon } from "./player-icon";
import { positionLabel } from "./position-name";
import { lineupPhoto } from "@/lib/lineup-photo";

/** Keep the same order as the Players table. */
export function TeamLineup({ team }: { team: Team }) {
  const roster = getRoster(team.rosterId);
  const spriteClass = "size-9";
  const players = [
    ...numberedPlayers(team.players).map((player) => ({
      id: player.id,
      label: [
        player.name,
        positionLabel(roster?.players.find((p) => p.id === player.positionId)?.position ?? player.positionId),
      ]
        .filter(Boolean)
        .join(" · "),
      icon: <PlayerIcon positionId={player.positionId} className={spriteClass} />,
    })),
    ...team.stars.map((id) => ({
      id,
      label: stars.find((star) => star.id === id)?.name ?? id,
      icon: <StarPlayerIcon starId={id} className={spriteClass} />,
    })),
  ].slice(0, 16);

  if (!players.length) return null;
  const photo = lineupPhoto(players.length);

  return (
    <ol
      aria-label="Team lineup"
      className="relative isolate mt-1 max-w-full"
      style={{ width: photo[0].width, height: 62 }}
    >
      {players.map((player, index) => (
        <li
          key={player.id}
          title={player.label}
          data-photo-row={photo[index].row}
          className={`absolute ${spriteClass} drop-shadow-[0_2px_1px_rgba(0,0,0,0.35)]`}
          style={{ left: photo[index].left, top: photo[index].top, zIndex: photo[index].zIndex }}
        >
          {player.icon}
          <span className="sr-only">{player.label}</span>
        </li>
      ))}
    </ol>
  );
}
