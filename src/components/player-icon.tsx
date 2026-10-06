import Image from "next/image";
import { Shield, Star, Users } from "lucide-react";
import {
  getPositionArtwork,
  getStarArtwork,
  type PlayerArtwork,
} from "@/domain/player-icons";
import { getRoster } from "@/domain/catalog";
import { cn } from "@/lib/utils";

function Artwork({
  artwork,
  variant = 0,
  className,
  fallback: Fallback,
}: {
  artwork?: PlayerArtwork;
  variant?: number;
  className?: string;
  fallback: typeof Users;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center",
        className,
      )}
    >
      {artwork ? (
        <Image
          src={artwork.variants[Math.abs(variant) % artwork.variants.length]}
          width={artwork.width}
          height={artwork.height}
          alt=""
          unoptimized
          className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
          style={{ width: artwork.width, height: artwork.height }}
        />
      ) : (
        <Fallback className="size-5 text-muted-foreground" />
      )}
    </span>
  );
}
export function PlayerIcon({
  positionId,
  variant,
  className,
}: {
  positionId: string;
  variant?: number;
  className?: string;
}) {
  return (
    <Artwork
      artwork={getPositionArtwork(positionId)}
      variant={variant}
      className={className}
      fallback={Users}
    />
  );
}
export function RosterIcon({
  rosterId,
  className,
}: {
  rosterId: string;
  className?: string;
}) {
  const iconUrl = `/assets/team-icons/${rosterId}.svg`;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center",
        className,
      )}
    >
      {getRoster(rosterId) ? (
        <span
          className="block size-full bg-current"
          style={{
            maskImage: `url("${iconUrl}")`,
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "contain",
            WebkitMaskImage: `url("${iconUrl}")`,
          }}
        />
      ) : (
        <Shield className="size-2/3" />
      )}
    </span>
  );
}
export function StarPlayerIcon({
  starId,
  className,
}: {
  starId: string;
  className?: string;
}) {
  return (
    <Artwork
      artwork={getStarArtwork(starId)}
      className={className}
      fallback={Star}
    />
  );
}
