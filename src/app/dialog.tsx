"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export type DialogClosePolicy = "none" | "escape" | "backdrop" | "escape-and-backdrop";

export function allowsDialogClose(policy: DialogClosePolicy, reason: "escape" | "backdrop") {
  return policy === reason || policy === "escape-and-backdrop";
}

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  closePolicy = "escape-and-backdrop",
  closeLabel = "Close dialog",
  showCloseButton = true,
  eyebrow,
  className = "max-w-xl",
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  closePolicy?: DialogClosePolicy;
  closeLabel?: string;
  showCloseButton?: boolean;
  eyebrow?: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const pointerStartedOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const requestClose = () => {
    onClose();
    queueMicrotask(() => triggerRef.current?.focus());
  };

  return <dialog
    ref={dialogRef}
    aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    onCancel={(event) => {
      event.preventDefault();
      if (allowsDialogClose(closePolicy, "escape")) requestClose();
    }}
    onPointerDown={(event) => { pointerStartedOnBackdrop.current = event.target === event.currentTarget; }}
    onClick={(event) => {
      const backdropClick = pointerStartedOnBackdrop.current && event.target === event.currentTarget;
      pointerStartedOnBackdrop.current = false;
      if (backdropClick && allowsDialogClose(closePolicy, "backdrop")) requestClose();
    }}
    className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border border-border-strong bg-surface-raised p-0 text-text-primary shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm sm:max-h-[calc(100dvh-3rem)] ${className}`}
  >
    <section className="responsive-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? <p className="text-sm font-semibold tracking-[0.18em] text-brand uppercase">{eyebrow}</p> : null}
          <h2 id={titleId} className={`${eyebrow ? "mt-3" : ""} text-2xl font-semibold`}>{title}</h2>
          {description ? <p id={descriptionId} className="mt-3 text-text-muted">{description}</p> : null}
        </div>
        {showCloseButton ? <button type="button" aria-label={closeLabel} onClick={requestClose} className="rounded-full px-2 py-1 text-xl leading-none text-text-muted hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">×</button> : null}
      </div>
      {children}
    </section>
  </dialog>;
}
