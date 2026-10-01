import { Send } from "lucide-react";
import { version } from "../../package.json";

export function SiteFooter() {
  const linkClass =
    "inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
  return (
    <footer className="no-print shrink-0 border-t border-border py-5">
      <div className="page-width flex flex-col items-start justify-between gap-3 text-xs text-muted-foreground md:flex-row md:items-center md:gap-6">
        <p className="leading-relaxed">
          © 2026 Martin Bahniuk · Blood Bowl Sideline
          <span className="text-orange-500">.</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href="https://t.me/martinAbsolute"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <Send aria-hidden="true" className="size-4" />
            Telegram
          </a>
          <a
            href="https://github.com/martinAbsolute/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {/* GitHub Octicons mark-github-16, MIT; see THIRD_PARTY_NOTICES.md. */}
            <svg
              aria-hidden="true"
              className="size-4"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
            </svg>
            GitHub
          </a>
          <p className="font-mono tabular-nums">v{version}</p>
        </div>
      </div>
    </footer>
  );
}
