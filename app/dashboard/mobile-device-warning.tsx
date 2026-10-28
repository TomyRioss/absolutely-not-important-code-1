"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HiExclamationTriangle } from "react-icons/hi2";

function subscribeToViewport(onChange: () => void) {
  const mediaQuery = window.matchMedia("(max-width: 767px)");
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getMobileSnapshot() {
  return window.matchMedia("(max-width: 767px)").matches;
}

export function MobileDeviceWarning() {
  const isMobile = useSyncExternalStore(
    subscribeToViewport,
    getMobileSnapshot,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const open = isMobile && !dismissed;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;

    dialog.showModal();
    continueButtonRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  function dismiss() {
    setDismissed(true);
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="mobile-device-warning-title"
      aria-describedby="mobile-device-warning-description"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-danger/40 bg-background p-0 text-text-primary shadow-xl backdrop:bg-black/60"
    >
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-danger">
          <HiExclamationTriangle
            aria-hidden="true"
            className="h-5 w-5 shrink-0"
          />
          <span>Atención</span>
        </div>
        <h2
          id="mobile-device-warning-title"
          className="text-lg font-bold leading-snug text-danger"
        >
          No optimizado para tu dispositivo
        </h2>
        <p
          id="mobile-device-warning-description"
          className="mt-2 text-sm leading-relaxed text-text-secondary"
        >
          Te recomendamos usar una laptop, notebook o PC para tener la mejor
          experiencia. Podés continuar desde este dispositivo, pero podrías
          encontrar fallos.
        </p>
        <button
          ref={continueButtonRef}
          type="button"
          onClick={dismiss}
          className="mt-5 min-h-11 w-full rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2"
        >
          Entendido, continuar
        </button>
      </div>
    </dialog>
  );
}
