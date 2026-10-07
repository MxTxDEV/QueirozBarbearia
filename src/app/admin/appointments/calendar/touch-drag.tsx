"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Arrastar com o dedo (celular/tablet). O arrastar nativo do navegador (HTML5)
 * não funciona de forma confiável com toque, então aqui é um "segurar e
 * arrastar": segure o card ~0,4 s (vibra de leve), e então arraste — soltar em
 * cima de outro card troca os dois; soltar numa área de dia/horário muda o horário.
 *
 * Antes de segurar, mexer o dedo é rolagem normal (a página e o carrossel
 * continuam rolando). Depois de ativar, a rolagem é travada e só o arrastar vale.
 *
 * Os alvos se declaram no HTML com data-attributes (ver `dropTargetProps`), e o
 * componente que recebe o drop decide o que fazer — este arquivo só detecta.
 */

export type TouchDropTarget =
  | { kind: "swap"; id: string }
  | { kind: "move"; date: string; time?: string; barberId?: string; barberName?: string };

const LONG_PRESS_MS = 400;
const MOVE_TOLERANCE_PX = 10;
const EDGE_SCROLL_ZONE_PX = 72;
const EDGE_SCROLL_STEP_PX = 14;
const TARGET_SELECTOR = "[data-touch-drop]";

/** Atributos que transformam um elemento em alvo de drop (cola com {...dropTargetProps(...)}). */
export function dropTargetProps(target: TouchDropTarget) {
  if (target.kind === "swap") return { "data-touch-drop": "swap", "data-drop-id": target.id } as const;
  return {
    "data-touch-drop": "move",
    "data-drop-date": target.date,
    "data-drop-time": target.time,
    "data-drop-barber": target.barberId,
    "data-drop-barber-name": target.barberName,
  } as const;
}

function readTarget(node: HTMLElement): TouchDropTarget | null {
  const { touchDrop, dropId, dropDate, dropTime, dropBarber, dropBarberName } = node.dataset;
  if (touchDrop === "swap" && dropId) return { kind: "swap", id: dropId };
  if (touchDrop === "move" && dropDate) {
    return { kind: "move", date: dropDate, time: dropTime || undefined, barberId: dropBarber || undefined, barberName: dropBarberName || undefined };
  }
  return null;
}

/** Alvo sob o dedo — ignora o próprio card de origem e sobe até a área (dia) que o contém. */
function targetAt(x: number, y: number, sourceId: string): { node: HTMLElement; target: TouchDropTarget } | null {
  let node = document.elementFromPoint(x, y)?.closest<HTMLElement>(TARGET_SELECTOR) ?? null;
  while (node) {
    const target = readTarget(node);
    if (target && !(target.kind === "swap" && target.id === sourceId)) return { node, target };
    node = node.parentElement?.closest<HTMLElement>(TARGET_SELECTOR) ?? null;
  }
  return null;
}

/** Envolve um card: ele vira origem do arrastar (segurar) e, ao mesmo tempo, alvo de troca. */
export function TouchDraggable({
  id,
  label,
  enabled,
  onDrop,
  className,
  children,
}: {
  id: string;
  label: string;
  enabled: boolean;
  onDrop: (sourceId: string, target: TouchDropTarget) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => {
    dropRef.current = onDrop;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let scrollTimer: ReturnType<typeof setInterval> | null = null;
    let active = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let ghost: HTMLDivElement | null = null;
    let hovered: HTMLElement | null = null;

    function setHovered(next: HTMLElement | null) {
      if (hovered === next) return;
      hovered?.removeAttribute("data-drop-hover");
      hovered = next;
      hovered?.setAttribute("data-drop-hover", "true");
    }

    function refreshHover() {
      if (ghost) {
        ghost.style.left = `${lastX}px`;
        ghost.style.top = `${lastY}px`;
      }
      setHovered(targetAt(lastX, lastY, id)?.node ?? null);
    }

    function cleanup() {
      if (timer) clearTimeout(timer);
      if (scrollTimer) clearInterval(scrollTimer);
      timer = scrollTimer = null;
      ghost?.remove();
      ghost = null;
      setHovered(null);
      if (active) el!.style.opacity = "";
      active = false;
    }

    function activate() {
      active = true;
      navigator.vibrate?.(20);
      el!.style.opacity = "0.4";
      ghost = document.createElement("div");
      ghost.textContent = label;
      Object.assign(ghost.style, {
        position: "fixed",
        zIndex: "100",
        pointerEvents: "none",
        transform: "translate(-50%, -140%)",
        maxWidth: "75vw",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        padding: "6px 12px",
        borderRadius: "9999px",
        background: "var(--secondary-dark, #0369a1)",
        color: "#fff",
        fontSize: "13px",
        fontWeight: "600",
        boxShadow: "0 8px 24px rgba(0,0,0,.45)",
      } satisfies Partial<CSSStyleDeclaration>);
      document.body.appendChild(ghost);
      refreshHover();
      // Perto da borda da tela, rola a página sozinho pra alcançar dias mais longe.
      scrollTimer = setInterval(() => {
        if (lastY < EDGE_SCROLL_ZONE_PX) window.scrollBy(0, -EDGE_SCROLL_STEP_PX);
        else if (lastY > window.innerHeight - EDGE_SCROLL_ZONE_PX) window.scrollBy(0, EDGE_SCROLL_STEP_PX);
        else return;
        refreshHover();
      }, 16);
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return cleanup();
      const touch = event.touches[0];
      startX = lastX = touch.clientX;
      startY = lastY = touch.clientY;
      timer = setTimeout(activate, LONG_PRESS_MS);
    }

    function onTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      lastX = touch.clientX;
      lastY = touch.clientY;
      if (!active) {
        // Mexeu antes de segurar o suficiente: é rolagem, não arrastar.
        if (Math.hypot(lastX - startX, lastY - startY) > MOVE_TOLERANCE_PX) cleanup();
        return;
      }
      if (event.cancelable) event.preventDefault(); // trava a rolagem enquanto arrasta
      refreshHover();
    }

    function onTouchEnd(event: TouchEvent) {
      const wasActive = active;
      const hit = wasActive ? targetAt(lastX, lastY, id) : null;
      cleanup();
      if (!wasActive) return;
      if (event.cancelable) event.preventDefault(); // não deixa virar clique em algum botão do card
      if (hit) dropRef.current(id, hit.target);
    }

    // Só o toque longo no CARD dispara; menu de contexto/seleção de texto do segurar ficam desligados.
    const onContextMenu = (event: Event) => event.preventDefault();

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", cleanup);
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      cleanup();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", cleanup);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [id, label, enabled]);

  return (
    <div
      ref={ref}
      {...(enabled ? dropTargetProps({ kind: "swap", id }) : {})}
      className={cn(
        "rounded-2xl transition-shadow data-[drop-hover=true]:ring-2 data-[drop-hover=true]:ring-secondary",
        enabled && "select-none [-webkit-touch-callout:none]",
        className
      )}
    >
      {children}
    </div>
  );
}
