import Image from "next/image";
import { Shield, Star, Users } from "lucide-react";
import { getPositionArtwork, getStarArtwork, getRosterIconSrc, type PlayerArtwork } from "@/domain/player-icons";
import { getRoster } from "@/domain/catalog";
import { cn } from "@/lib/utils";

function Artwork({
  artwork,
  className,
  fallback: Fallback,
}: {
  artwork?: PlayerArtwork;
  className?: string;
  fallback: typeof Users;
}) {
  return (
    <span aria-hidden="true" className={cn("inline-flex size-12 shrink-0 items-center justify-center", className)}>
      {artwork ? (
        <Image
          src={artwork.src}
          width={artwork.width}
          height={artwork.height}
          alt=""
          unoptimized
          className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
          style={{ width: "auto", height: "auto" }}
        />
      ) : (
        <Fallback className="size-5 text-muted-foreground" />
      )}
    </span>
  );
}
export function PlayerIcon({ positionId, className }: { positionId: string; className?: string }) {
  return <Artwork artwork={getPositionArtwork(positionId)} className={className} fallback={Users} />;
}
export function RosterIcon({ rosterId, className }: { rosterId: string; className?: string }) {
  const iconUrl = getRosterIconSrc(rosterId);
  return (
    <span aria-hidden="true" className={cn("inline-flex size-12 shrink-0 items-center justify-center", className)}>
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
export function StarPlayerIcon({ starId, className }: { starId: string; className?: string }) {
  return <Artwork artwork={getStarArtwork(starId)} className={className} fallback={Star} />;
}
