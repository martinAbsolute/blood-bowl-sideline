import { cn } from "@/lib/utils";
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 52"
      aria-hidden="true"
      className={cn("size-10", className)}
    >
      <path
        d="M4 5 24 1 44 5v25c0 10-20 20-20 20S4 40 4 30Z"
        fill="currentColor"
      />
      <path d="m15 14 18 4-4 15-18-4Z" fill="var(--paper)" />
      <path
        d="m19 20 9 2m-8-4-2 9m5-8-2 9m5-8-2 9"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m12 36 11 3 12-4"
        fill="none"
        stroke="var(--paper)"
        strokeWidth="2"
      />
    </svg>
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
