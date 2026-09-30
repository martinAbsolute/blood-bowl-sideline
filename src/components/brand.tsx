import Image from "next/image";
import { cn } from "@/lib/utils";
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/lockup.svg"
      width={690}
      height={156}
      alt=""
      aria-hidden="true"
      unoptimized
      className={cn("h-9 w-auto shrink-0", className)}
    />
  );
}
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo.svg"
      width={38}
      height={52}
      alt=""
      aria-hidden="true"
      unoptimized
      className={cn("h-10 w-auto shrink-0", className)}
    />
  );
}
export function PitchArt() {
  return (
    <div className="pitch-art" aria-hidden="true">
      <div className="pitch-stamp">
        SIDELINE
        <br />
        <span>EST. 2026</span>
      </div>
      <div className="pitch-lines">
        <div className="pitch-half" />
        <div className="pitch-circle" />
        <div className="pitch-zone top" />
        <div className="pitch-zone bottom" />
      </div>
      <div className="pitch-token token-one">03</div>
      <div className="pitch-token token-two">07</div>
      <div className="pitch-token token-three">11</div>
      <div className="pitch-token token-four">02</div>
      <svg viewBox="0 0 180 150" className="pitch-route">
        <path
          d="M15 125C5 75 30 40 75 55S125 90 145 15"
          fill="none"
          stroke="#e9f0ce"
          strokeWidth="3"
          strokeDasharray="8 8"
        />
        <path
          d="m131 24 15-12 7 19"
          fill="none"
          stroke="#e9f0ce"
          strokeWidth="3"
        />
      </svg>
      <div className="pitch-ball">✚</div>
      <div className="pitch-label">
        MAKE YOUR
        <br />
        <strong>NEXT PLAY.</strong>
      </div>
    </div>
  );
}
