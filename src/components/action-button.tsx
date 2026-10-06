"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "./ui/button";
import { IconTransition } from "./ui/icon-transition";

type ActionState = "idle" | "pending" | "loading" | "success" | "error";
type ActionButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  onClick: () => Promise<void | boolean>;
  icon: ReactNode;
  successLabel: string;
  errorLabel: string;
};

export function ActionButton({
  onClick,
  icon,
  successLabel,
  errorLabel,
  className,
  children,
  disabled,
  ...props
}: ActionButtonProps) {
  const [state, setState] = useState<ActionState>("idle");
  const active = useRef(false);
  const mounted = useRef(true);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    mounted.current = true;
    const pendingTimers = timers.current;
    return () => {
      mounted.current = false;
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
    };
  }, []);

  function schedule(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      if (mounted.current) callback();
    }, delay);
    timers.current.add(timer);
    return timer;
  }

  async function handleClick() {
    if (disabled || active.current) return;
    active.current = true;
    setState("pending");
    const loadingTimer = schedule(() => setState("loading"), 50);
    let outcome: ActionState;
    try {
      outcome = (await onClick()) === false ? "idle" : "success";
    } catch {
      outcome = "error";
    } finally {
      clearTimeout(loadingTimer);
      timers.current.delete(loadingTimer);
    }
    if (!mounted.current) return;
    setState(outcome);
    if (outcome === "idle") active.current = false;
    else
      schedule(() => {
        active.current = false;
        setState("idle");
      }, 1500);
  }

  const feedback =
    state === "success" ? successLabel : state === "error" ? errorLabel : "";
  return (
    <Button
      {...props}
      className={cn("relative", className)}
      onClick={handleClick}
      disabled={disabled || state !== "idle"}
      aria-busy={state === "pending" || state === "loading"}
      data-action-state={state}
      title={feedback || props.title}
    >
      <span
        aria-hidden="true"
        className="relative inline-flex size-4 shrink-0 items-center justify-center"
      >
        <IconTransition show={state === "idle" || state === "pending"}>
          {icon}
        </IconTransition>
        <IconTransition show={state === "loading"}>
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        </IconTransition>
        <IconTransition show={state === "success"}>
          <Check className="size-4" />
        </IconTransition>
        <IconTransition show={state === "error"}>
          <X className="size-4 text-destructive" />
        </IconTransition>
      </span>
      <span
        className={cn(
          "transition-opacity duration-150 motion-reduce:transition-none",
          state !== "idle" && "opacity-70",
        )}
      >
        {children}
      </span>
      <span role="status" className="sr-only">
        {feedback}
      </span>
    </Button>
  );
}
