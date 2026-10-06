import { getRoster, stars } from "@/domain/catalog";
import type { Team } from "@/domain/types";
import { PlayerIcon, StarPlayerIcon } from "./player-icon";
import { positionLabel } from "./position-name";

/** Keep the same order and artwork variants as the Players table. */
export function TeamLineup({ team }: { team: Team }) {
  const roster = getRoster(team.rosterId);
  const players = [
    ...team.players.map((player, index) => ({
      id: player.id,
      label: [
        player.name,
        positionLabel(
          roster?.players.find((p) => p.id === player.positionId)?.position ??
            player.positionId,
        ),
      ]
        .filter(Boolean)
        .join(" · "),
      icon: (
        <PlayerIcon
          positionId={player.positionId}
          variant={index}
          className="size-8"
        />
      ),
    })),
    ...team.stars.map((id) => ({
      id,
      label: stars.find((star) => star.id === id)?.name ?? id,
      icon: <StarPlayerIcon starId={id} className="size-8" />,
    })),
  ].slice(0, 16);

  if (!players.length) return null;

  return (
    <ol
      className="relative isolate mt-1 h-11 max-w-full"
      style={{ width: 32 + (players.length - 1) * 20 }}
    >
      {players.map((player, index) => (
        <li
          key={player.id}
          title={player.label}
          className="absolute size-8 drop-shadow-[0_2px_1px_rgba(0,0,0,0.35)]"
          style={{
            left: `calc((100% - 32px) * ${index / Math.max(1, players.length - 1)})`,
            top: index % 2 === 0 ? 0 : 12,
            zIndex: players.length - index,
          }}
        >
          {player.icon}
          <span className="sr-only">{player.label}</span>
        </li>
      ))}
    </ol>
  );
}
