"use client";

import * as React from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn } from "@/lib/utils";
import { SearchIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

const CommandContext = React.createContext("");

function Command({
  className,
  children,
  value,
  defaultValue = "",
  onValueChange,
  ...props
}: Omit<
  Autocomplete.Root.Props<string>,
  "children" | "items" | "filteredItems" | "value" | "defaultValue"
> & {
  children: React.ReactNode;
  className?: string;
  value?: string;
  defaultValue?: string;
}) {
  const [query, setQuery] = React.useState(defaultValue);
  const search = value ?? query;
  return (
    <Autocomplete.Root<string>
      inline
      open
      autoHighlight="always"
      mode="none"
      {...props}
      value={search}
      onValueChange={(next, details) => {
        setQuery(next);
        onValueChange?.(next, details);
      }}
    >
      <CommandContext.Provider value={search}>
        <div
          data-slot="command"
          className={cn(
            "flex size-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground",
            className,
          )}
        >
          {children}
        </div>
      </CommandContext.Provider>
    </Autocomplete.Root>
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn("overflow-hidden p-0", className)}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: Autocomplete.Input.Props) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex items-center gap-2 border-b px-3"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      <Autocomplete.Input
        data-slot="command-input"
        className={cn(
          "h-10 w-full bg-transparent text-sm outline-none disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: Autocomplete.List.Props) {
  return (
    <Autocomplete.List
      data-slot="command-list"
      className={cn(
        "max-h-72 overflow-x-hidden overflow-y-auto p-1 outline-none",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: Autocomplete.Empty.Props) {
  return (
    <Autocomplete.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: Autocomplete.Group.Props & { heading?: React.ReactNode }) {
  return (
    <Autocomplete.Group
      data-slot="command-group"
      className={cn("p-1 text-foreground", className)}
      {...props}
    >
      {heading && (
        <Autocomplete.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </Autocomplete.GroupLabel>
      )}
      {children}
    </Autocomplete.Group>
  );
}

function CommandSeparator({
  className,
  ...props
}: Autocomplete.Separator.Props) {
  return (
    <Autocomplete.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function textContent(node: React.ReactNode): string {
  return React.Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number")
        return String(child);
      return React.isValidElement<{ children?: React.ReactNode }>(child)
        ? textContent(child.props.children)
        : "";
    })
    .join(" ");
}

function CommandItem({
  className,
  children,
  value,
  keywords = [],
  onSelect,
  onClick,
  ...props
}: Autocomplete.Item.Props & {
  value?: string;
  keywords?: string[];
  onSelect?: (value: string) => void;
}) {
  const query = React.useContext(CommandContext);
  const itemValue = value ?? textContent(children);
  const { contains } = Autocomplete.useFilter({ sensitivity: "base" });
  if (query && !contains([itemValue, ...keywords].join(" "), query))
    return null;
  return (
    <Autocomplete.Item
      data-slot="command-item"
      value={itemValue}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelect?.(itemValue);
      }}
    >
      {children}
    </Autocomplete.Item>
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
