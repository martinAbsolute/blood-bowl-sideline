"use client";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { signInReturnPath } from "@/lib/draft-sign-in";

type Prepare = () => string;
type DraftSignIn = {
  register: (prepare: Prepare) => () => void;
  prepare: () => string;
};
const Context = createContext<DraftSignIn | null>(null);

export function DraftSignInProvider({ children }: { children: ReactNode }) {
  const current = useRef<Prepare | null>(null);
  const value = useMemo<DraftSignIn>(
    () => ({
      register(prepare) {
        current.current = prepare;
        return () => {
          if (current.current === prepare) current.current = null;
        };
      },
      prepare() {
        return current.current?.() ?? signInReturnPath(window.location);
      },
    }),
    [],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDraftSignIn() {
  const value = useContext(Context);
  if (!value) throw new Error("DraftSignInProvider is missing");
  return value;
}
