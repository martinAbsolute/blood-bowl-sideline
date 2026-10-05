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
