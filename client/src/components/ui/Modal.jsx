import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog:
 *  - always renders a visible close button (even without a title)
 *  - names itself via `title` or `labelledById` (e.g. the task title input)
 *  - moves focus into the dialog on open, traps Tab inside, and restores
 *    focus to the previously focused element on close
 *  - closes on Escape and on backdrop clicks
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
  labelledById,
}) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement;
    dialogRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      // Basic focus trap: cycle Tab/Shift+Tab within the dialog
      const focusables = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE)).filter(
        (el) => !el.disabled
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Restore focus to where the user was before the dialog opened
      if (previouslyFocused.current?.focus) previouslyFocused.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const closeBtn = (
    <button
      onClick={onClose}
      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      aria-label="Close dialog"
    >
      <X size={18} />
    </button>
  );

  const labelledby = title !== undefined ? 'modal-heading' : labelledById;

  return (
    // Clicking the backdrop dismisses the dialog; all interactive content
    // lives inside the dialog element below.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fadeIn"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledby}
      aria-label={labelledby ? undefined : 'Dialog'}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={clsx(
          'bg-white rounded-2xl shadow-pop w-full animate-popIn max-h-[90vh] flex flex-col outline-none',
          width
        )}
      >
        {title !== undefined ? (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 id="modal-heading" className="text-base font-semibold text-slate-800">
              {title}
            </h2>
            {closeBtn}
          </div>
        ) : (
          <div className="flex justify-end px-4 pt-3">{closeBtn}</div>
        )}
        <div className="overflow-y-auto thin-scroll">{children}</div>
      </div>
    </div>
  );
}
