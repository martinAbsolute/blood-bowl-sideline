"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "gt-next";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Search, X } from "lucide-react";
import { skills, skillName } from "@/domain/catalog";
import { skillAccess } from "@/domain/rules";
import type { Position } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { SkillBox } from "./skill-box";

const selectedZone = "selected-skills";
const availableZone = "available-skills";
const collisions: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args);
  const hits = pointerWithin(args);
  const items = hits.filter(
    (hit) => hit.id !== selectedZone && hit.id !== availableZone,
  );
  return items.length ? items : hits;
};

function AvailableSkill({
  id,
  position,
  disabled,
  onAdd,
}: {
  id: string;
  position: Position;
  disabled: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id, disabled });
  const skill = skills.find((skill) => skill.id === id)!;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-1 rounded-md border bg-card p-2",
        isDragging && "opacity-40",
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 touch-none cursor-grab active:cursor-grabbing"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label={`${t("dragSkill")} · ${skillName(id)}`}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </Button>
      <div className="min-w-0 flex-1">
        <SkillBox id={id} />
        <p className="mt-1 text-xs text-muted-foreground">
          {t(skillAccess(position, id)!)}
          {skill.isElite ? ` · ${t("elite")}` : ""}
        </p>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        disabled={disabled}
        onClick={onAdd}
        aria-label={`${t("addSkill")} · ${skillName(id)}`}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function SelectedSkill({
  id,
  index,
  onRemove,
}: {
  id: string;
  index: number;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-md border bg-card p-2",
        isDragging && "opacity-40",
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 touch-none cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={`${t("dragSkill")} · ${skillName(id)}`}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </Button>
      <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <SkillBox id={id} added />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        onClick={onRemove}
        aria-label={`${t("removeSkill")} · ${skillName(id)}`}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

function SkillDropZone({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-skill-zone={id}
      className={cn(
        "min-w-0 rounded-lg border border-dashed bg-secondary/25 p-2 transition-colors",
        isOver && "border-primary bg-secondary ring-2 ring-ring/30",
      )}
    >
      {children}
    </div>
  );
}

export function PlayerSkillPicker({
  position,
  selected,
  max,
  captain,
  onChange,
}: {
  position: Position;
  selected: string[];
  max: number;
  captain: boolean;
  onChange: (skills: string[]) => void;
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const eligible = skills.filter(
    (skill) =>
      skillAccess(position, skill.id) &&
      !position.skills.some((id) => id.split(":")[0] === skill.id) &&
      !selected.includes(skill.id) &&
      !(captain && skill.id === "pro"),
  );
  const available = eligible.filter((skill) =>
    skill.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const full = selected.length >= max;
  function add(id: string, index = selected.length) {
    if (full || !eligible.some((skill) => skill.id === id)) return;
    const next = [...selected];
    next.splice(index, 0, id);
    onChange(next);
  }
  function drop({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const id = String(active.id);
    const from = selected.indexOf(id);
    const to = selected.indexOf(String(over.id));
    if (from >= 0) {
      if (over.id === availableZone)
        onChange(selected.filter((skill) => skill !== id));
      else if (to >= 0 && from !== to) onChange(arrayMove(selected, from, to));
    } else if (over.id === selectedZone || to >= 0) {
      add(id, to >= 0 ? to : selected.length);
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisions}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={drop}
      accessibility={{
        screenReaderInstructions: { draggable: t("skillDragInstructions") },
        announcements: {
          onDragStart: ({ active }) =>
            `${t("dragSkill")} · ${skillName(String(active.id))}`,
          onDragOver: ({ over }) =>
            over
              ? `${t("dropSkill")} · ${over.id === selectedZone ? t("addedSkills") : over.id === availableZone ? t("availableSkills") : skillName(String(over.id))}`
              : undefined,
          onDragEnd: ({ active }) =>
            `${t("skillDragFinished")} · ${skillName(String(active.id))}`,
          onDragCancel: () => t("skillDragCancelled"),
        },
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
          {t("skillPickerHint")}
        </p>
        <div className="sticky top-0 z-10 space-y-3 bg-background pb-2 sm:static sm:pb-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t("addedSkills")}</h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs">
              {selected.length}/{max}
            </span>
          </div>
          <SkillDropZone id={selectedZone}>
            <ScrollArea className="h-24 sm:h-64">
              <SortableContext
                items={selected}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 pr-3">
                  {selected.map((id, index) => (
                    <SelectedSkill
                      key={id}
                      id={id}
                      index={index}
                      onRemove={() =>
                        onChange(selected.filter((skill) => skill !== id))
                      }
                    />
                  ))}
                  {!selected.length && (
                    <p className="flex min-h-20 items-center justify-center px-4 text-center text-sm text-muted-foreground sm:min-h-60">
                      {t("dropSkillsHere")}
                    </p>
                  )}
                </div>
              </SortableContext>
            </ScrollArea>
          </SkillDropZone>
          {full && (
            <p className="text-xs text-muted-foreground" role="status">
              {t("skillLimitReached")}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t("availableSkills")}</h3>
            <span className="font-mono text-xs text-muted-foreground">
              {available.length}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchSkills")}
              aria-label={t("searchSkills")}
            />
          </div>
          <SkillDropZone id={availableZone}>
            <ScrollArea className="h-48 sm:h-64">
              <div className="space-y-2 pr-3">
                {available.map((skill) => (
                  <AvailableSkill
                    key={skill.id}
                    id={skill.id}
                    position={position}
                    disabled={full}
                    onAdd={() => add(skill.id)}
                  />
                ))}
                {!available.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("noMatchingSkills")}
                  </p>
                )}
              </div>
            </ScrollArea>
          </SkillDropZone>
        </div>
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay
            dropAnimation={null}
            className="pointer-events-none"
            zIndex={100}
          >
            {activeId ? (
              <div className="rounded-md border bg-card p-3 text-sm font-semibold shadow-lg">
                {skillName(activeId)}
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}
