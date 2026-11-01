import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
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
import { GripVertical } from "lucide-react";
import type { PointerEvent, ReactNode } from "react";
import { cn } from "../lib/cn";

export type SortableItem = {
  id: string;
  node: ReactNode;
  /** Extra row state classes: `sel` (selected), `feat` (featured accent bar). */
  className?: string;
  /** Accessible name for the drag handle, e.g. "Reorder Orbit Gateway". */
  label?: string;
};

type Variant = "project" | "gallery";

const Row = ({
  id,
  variant,
  disabled,
  disabledReason,
  className,
  label,
  children,
}: {
  id: string;
  variant: Variant;
  disabled: boolean;
  disabledReason?: string;
  className?: string;
  label: string;
  children: ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  // Cursor-following glow on project rows (CSS variables read by .sl-row.project::after).
  const track = (event: PointerEvent<HTMLDivElement>): void => {
    if (variant !== "project") return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      role="listitem"
      className={cn("sl-row", variant, className, isDragging && "lift")}
      onPointerMove={track}
    >
      <button
        type="button"
        className="grip"
        aria-label={label}
        title={disabled ? disabledReason : undefined}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical />
      </button>
      <div className="sl-body">{children}</div>
    </div>
  );
};

export const SortableList = ({
  items,
  onReorder,
  className,
  variant = "gallery",
  disabled = false,
  disabledReason = "Clear filters to reorder",
}: {
  items: SortableItem[];
  onReorder: (ids: string[]) => void;
  className?: string;
  variant?: Variant;
  /** Disables dragging (e.g. while a filter or search hides part of the list). */
  disabled?: boolean;
  disabledReason?: string;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent): void => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((item) => item.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn("grid gap-2", className)} role="list">
          {items.map((item) => (
            <Row
              key={item.id}
              id={item.id}
              variant={variant}
              disabled={disabled}
              disabledReason={disabledReason}
              className={item.className}
              label={item.label ?? "Drag to reorder"}
            >
              {item.node}
            </Row>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
