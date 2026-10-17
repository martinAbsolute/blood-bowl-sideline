# Component primitives

Application components use shadcn/ui with Base UI. The registry style in `components.json` is `base-nova`.

- Use `render` for composition. Buttons rendering links need `nativeButton={false}`.
- Accordion values are arrays. Dialog focus uses `initialFocus` / `finalFocus`; CSS state selectors use `data-open`, `data-closed`, and `--accordion-panel-height`.
- `ui/command.tsx` uses Base UI Autocomplete with an inline list. Root `value` / `onValueChange` control the search text; item `onSelect` handles selection.
- `ui/form.tsx` integrates React Hook Form with Base UI `useRender`. Pass controls using `render={<Input />}`.
- Notifications use `toast.add({ type: "success", title: message })` from `ui/toast`. Mount `Toaster` once in the providers. `ui/sonner.tsx` exposes the same implementation.
- `ReadinessCard` composes the shadcn card primitives with a conditional Tailwind success style.

Use Tailwind utilities for component styling and the shared tokens in `src/app/sideline.css`. Keep custom CSS for layout, print rules, and browser workarounds that need it.
