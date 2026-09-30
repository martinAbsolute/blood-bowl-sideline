# Component primitives

The full shadcn and Magic UI collection is retained. `components.json` uses
`base-nova`, so future shadcn installations resolve to Base UI. Install or upgrade
components with `pnpm exec shadcn add <name> --overwrite` and review the diff.

The following components need special care when reinstalling:

- `ui/command.tsx` uses Base UI Autocomplete with an inline list. Its exports remain
  available; root `value` / `onValueChange` control the search text, and item
  `onSelect` handles selection. The official registry currently uses cmdk, which
  brings Radix back into the dependency tree.
- `ui/form.tsx` keeps React Hook Form integration and uses Base UI `useRender`
  for composition. Pass the control to `FormControl` using `render={<Input />}`.
  The legacy registry implementation still uses Radix Slot.
- `ui/sonner.tsx` re-exports the Base UI toast implementation. Use
  `toast.add({ type: "success", title: message })` from `ui/toast` and mount
  `Toaster` once in the providers.
- Magic UI `bento-grid`, `file-tree`, and `rainbow-button` have local Base UI
  adaptations. Their upstream registry still uses Radix. Preserve these
  adaptations when upgrading.

Use `render` for composition instead of Radix `asChild`. Buttons rendering links
need `nativeButton={false}`. Accordion values are arrays. Dialog focus uses
`initialFocus` / `finalFocus`; CSS state selectors use `data-open`, `data-closed`,
and `--accordion-panel-height`.

Specialized libraries for charts, drag and drop, calendars, code highlighting,
animation, and other retained components remain installed because Base UI does
not replace those capabilities. Radix, cmdk, Vaul, and Sonner are removed.
