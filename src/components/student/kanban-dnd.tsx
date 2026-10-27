'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { PROGRESS_LABELS, type ProgressStatus } from '@/lib/progress';

const LONG_PRESS_MS = 180;
const SCROLL_CANCEL_PX = 12;
const EDGE_SCROLL_PX = 48;

type KanbanDndValue = {
  draggingId: string | null;
  overStatus: ProgressStatus | null;
  setOverStatus: (status: ProgressStatus | null) => void;
  beginHtml5Drag: (taskId: string) => void;
  endDrag: () => void;
  onCardPointerDown: (event: ReactPointerEvent, taskId: string, label: string) => void;
};

const KanbanDndContext = createContext<KanbanDndValue | null>(null);

export function useKanbanDnd() {
  return useContext(KanbanDndContext);
}

function columnFromPoint(x: number, y: number): ProgressStatus | null {
  const el = document.elementFromPoint(x, y);
  const column = el?.closest('[data-kanban-column]');
  const status = column?.getAttribute('data-kanban-column');
  return status === 'planning' || status === 'in_progress' || status === 'review' || status === 'done'
    ? status
    : null;
}

function autoScrollScroller(x: number) {
  const scroller = document.querySelector<HTMLElement>('[data-kanban-scroller]');
  if (!scroller) return;
  const rect = scroller.getBoundingClientRect();
  if (x < rect.left + EDGE_SCROLL_PX) scroller.scrollLeft -= 18;
  else if (x > rect.right - EDGE_SCROLL_PX) scroller.scrollLeft += 18;
}

export function KanbanDndProvider({
  children,
  onMove,
}: {
  children: ReactNode;
  onMove: (taskId: string, next: ProgressStatus) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ProgressStatus | null>(null);
  const [preview, setPreview] = useState<{ label: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{
    taskId: string;
    pointerId: number;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout> | null;
    active: boolean;
  } | null>(null);

  const clearPointerDrag = useCallback(() => {
    const current = dragRef.current;
    if (current?.timer != null) clearTimeout(current.timer);
    dragRef.current = null;
    setDraggingId(null);
    setOverStatus(null);
    setPreview(null);
  }, []);

  const beginHtml5Drag = useCallback((taskId: string) => {
    setDraggingId(taskId);
  }, []);

  const endDrag = useCallback(() => {
    setDraggingId(null);
    setOverStatus(null);
    setPreview(null);
  }, []);

  const activateTouchDrag = useCallback((taskId: string, label: string, x: number, y: number) => {
    const current = dragRef.current;
    if (!current || current.taskId !== taskId) return;
    current.active = true;
    current.timer = null;
    setDraggingId(taskId);
    setOverStatus(columnFromPoint(x, y));
    setPreview({ label, x, y });
  }, []);

  const onCardPointerDown = useCallback(
    (event: ReactPointerEvent, taskId: string, label: string) => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
      const target = event.target as Element | null;
      if (target?.closest('button, a, input, select, textarea, label')) return;

      const startX = event.clientX;
      const startY = event.clientY;
      dragRef.current = {
        taskId,
        pointerId: event.pointerId,
        startX,
        startY,
        timer: setTimeout(() => activateTouchDrag(taskId, label, startX, startY), LONG_PRESS_MS),
        active: false,
      };
    },
    [activateTouchDrag]
  );

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (!current.active) {
        if (Math.hypot(dx, dy) > SCROLL_CANCEL_PX) {
          if (current.timer != null) clearTimeout(current.timer);
          dragRef.current = null;
        }
        return;
      }

      event.preventDefault();
      autoScrollScroller(event.clientX);
      setOverStatus(columnFromPoint(event.clientX, event.clientY));
      setPreview((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
    }

    function onPointerUp(event: PointerEvent) {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const dropped = current.active ? columnFromPoint(event.clientX, event.clientY) : null;
      const taskId = current.taskId;
      clearPointerDrag();
      if (dropped) onMove(taskId, dropped);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [clearPointerDrag, onMove]);

  const value = useMemo(
    () => ({
      draggingId,
      overStatus,
      setOverStatus,
      beginHtml5Drag,
      endDrag,
      onCardPointerDown,
    }),
    [beginHtml5Drag, draggingId, endDrag, onCardPointerDown, overStatus]
  );

  return (
    <KanbanDndContext.Provider value={value}>
      {children}
      {preview &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-primary bg-card px-3 py-2 text-sm font-medium shadow-lg"
            style={{ left: preview.x, top: preview.y }}
          >
            {preview.label}
            {overStatus ? (
              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                Drop on {PROGRESS_LABELS[overStatus]}
              </span>
            ) : null}
          </div>,
          document.body
        )}
    </KanbanDndContext.Provider>
  );
}

export function isKanbanInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('button, a, input, select, textarea, label');
}
