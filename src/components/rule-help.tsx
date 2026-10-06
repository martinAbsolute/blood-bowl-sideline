"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "gt-next";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "./dialog";
import { Button } from "./ui/button";
import { CircleHelp } from "lucide-react";

function LabeledRuleText({ text }: { text: string }) {
  const label = /^([^:\n]{1,65}):\s/.exec(text);
  return label ? (
    <>
      <strong className="font-semibold">{label[1]}:</strong>{" "}
      {text.slice(label[0].length)}
    </>
  ) : (
    text
  );
}

export function RuleDescription({ description }: { description: string }) {
  return (
    <div className="space-y-3 text-base leading-relaxed">
      {description.split(/\n{2,}/).map((block, index) => {
        const lines = block.split("\n");
        if (
          lines.length > 1 &&
          lines.slice(1).every((line) => /^\d+\.\s/.test(line))
        ) {
          return (
            <section key={index}>
              <h3 className="mb-2 font-semibold">{lines[0]}</h3>
              <ol className="list-decimal space-y-2 pl-6 marker:font-semibold">
                {lines.slice(1).map((line) => (
                  <li key={line} className="pl-1">
                    <LabeledRuleText text={line.replace(/^\d+\.\s/, "")} />
                  </li>
                ))}
              </ol>
            </section>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            <LabeledRuleText text={block} />
          </p>
        );
      })}
    </div>
  );
}

/** Hover/focus for a quick explanation; click, tap or Enter for a persistent one. */
export function RuleHelp({
  title,
  description,
  meta,
  children,
  className,
  label,
  action,
  fullDescription = false,
  skillPreview = false,
}: {
  title: string;
  description: string;
  meta?: string;
  children: ReactNode;
  className?: string;
  label?: string;
  action?: {
    label: string;
    onClick: () => void;
    finalFocus?: () => HTMLElement | null;
  };
  fullDescription?: boolean;
  skillPreview?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const measurePreview = useCallback(
    (node: HTMLParagraphElement | null) => {
      if (node)
        setTruncated(
          description.length > 0 && node.scrollHeight > node.clientHeight,
        );
    },
    [description],
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionId = useId();
  return (
    <>
      <Tooltip open={hovered && !open} onOpenChange={setHovered}>
        <TooltipTrigger
          delay={250}
          render={
            <button
              ref={trigger}
              type="button"
              aria-label={label ?? title}
              aria-haspopup="dialog"
              className={cn(
                "rule-help rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className,
              )}
              onClick={() => {
                setHovered(false);
                setOpen(true);
              }}
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent
          sideOffset={6}
          className={cn(
            "w-80 max-w-[calc(100vw-2rem)] space-y-1.5 overflow-hidden px-3 py-2.5 text-sm leading-relaxed",
            skillPreview && "[@media(hover:none)]:hidden",
          )}
        >
          <p className="font-semibold">{title}</p>
          {meta && <p className="text-xs opacity-80">{meta}</p>}
          <p
            ref={skillPreview ? measurePreview : undefined}
            className={cn(
              "whitespace-pre-wrap",
              skillPreview
                ? "line-clamp-4"
                : !fullDescription && "line-clamp-10",
            )}
          >
            {description}
          </p>
          {skillPreview && truncated && (
            <p className="text-xs opacity-80">{t("clickToReadFullRule")}</p>
          )}
        </TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={meta ? descriptionId : undefined}
          className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"
          initialFocus={titleRef}
          finalFocus={() => {
            setHovered(false);
            return action?.finalFocus?.() ?? trigger.current;
          }}
        >
          <DialogHeader className="pr-6">
            <DialogTitle ref={titleRef} tabIndex={-1}>
              {title}
            </DialogTitle>
            {meta && (
              <DialogDescription id={descriptionId}>{meta}</DialogDescription>
            )}
          </DialogHeader>
          <RuleDescription description={description} />
          {action ? (
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <DialogClose
                render={<Button variant="outline" className="h-11 sm:h-8" />}
              >
                {t("cancel")}
              </DialogClose>
              <Button
                className="h-auto min-h-11 whitespace-normal sm:min-h-8"
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
              >
                {action.label}
              </Button>
            </div>
          ) : (
            <DialogClose render={<Button variant="outline" className="mt-2" />}>
              {t("ok")}
            </DialogClose>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RuleInfo({
  className,
  ...props
}: Omit<React.ComponentProps<typeof RuleHelp>, "children">) {
  return (
    <RuleHelp
      {...props}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-primary",
        className,
      )}
    >
      <CircleHelp className="size-4" aria-hidden="true" />
    </RuleHelp>
  );
}
