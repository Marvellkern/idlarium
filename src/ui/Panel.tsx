import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

/** Bottom sheet on phones, right-side panel on wider screens. */
export function Panel({
  title,
  subtitle,
  onClose,
  children,
  footer,
  compact,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Shorter sheet on phones so the scene above stays visible. */
  compact?: boolean;
}) {
  return (
    <section
      role="dialog"
      aria-label={title}
      className={`glass-strong animate-pop-in pointer-events-auto fixed inset-x-2 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 flex ${compact ? "max-h-[44vh]" : "max-h-[min(60vh,560px)]"} flex-col overflow-hidden md:inset-x-auto md:top-[84px] md:right-3 md:bottom-[96px] md:max-h-none md:w-[390px]`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black">{title}</h2>
          {subtitle && <div className="text-sm font-semibold text-ink-soft">{subtitle}</div>}
        </div>
        <CloseButton onClick={onClose} />
      </header>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
      {footer && <div className="border-t border-black/5 p-3">{footer}</div>}
    </section>
  );
}

/** Centered modal for bigger screens of content (codex, settings, summaries). */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-black/25 p-2 sm:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`glass-strong animate-pop-in flex max-h-[88vh] w-full flex-col overflow-hidden ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <header className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-2">
          <h2 className="truncate text-lg font-black">{title}</h2>
          {onClose && <CloseButton onClick={onClose} />}
        </header>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </section>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-black/5 hover:text-ink"
    >
      <CloseIcon />
    </button>
  );
}

export function PearlButton({
  cost,
  canAfford,
  onClick,
  disabled,
  label,
  ariaLabel,
  className = "",
}: {
  cost?: string;
  canAfford: boolean;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  /** Full spoken name, e.g. "Buy Guppy for 10 pearls". */
  ariaLabel?: string;
  className?: string;
}) {
  const off = disabled || !canAfford;
  const name = ariaLabel ?? [label, cost && `${cost} pearls`].filter(Boolean).join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={off}
      aria-label={name + (!disabled && !canAfford ? " (not enough pearls yet)" : "")}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[15px] font-extrabold transition ${
        off ? "bg-black/8 text-ink-soft" : "bg-ink text-white shadow-sm hover:brightness-125 active:scale-[0.98]"
      } ${className}`}
    >
      {label && <span>{label}</span>}
      {cost && (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff,#f4d6e2_55%,#d9b3c4)] ring-1 ring-black/10" />
          {cost}
          <span className="sr-only"> pearls</span>
        </span>
      )}
    </button>
  );
}
