import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog.
 *  - Always renders a visible close button.
 *  - Named by `title` (rendered as a heading) or by `labelledBy` (id of an
 *    element inside the dialog) when the content supplies its own heading.
 *  - Moves focus into the dialog on open, keeps Tab inside it, closes on
 *    Escape, and restores focus to the previously focused element on close.
 */
export default function Modal({ open, onClose, title, labelledBy, children, width = 'max-w-lg' }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const headingId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;

    // Focus the field marked data-autofocus, else the first focusable element.
    if (dialog && !dialog.contains(document.activeElement)) {
      const initial = dialog.querySelector('[data-autofocus]') || dialog.querySelector(FOCUSABLE) || dialog;
      initial.focus();
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  const hasTitle = title !== undefined && title !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fadeIn">
      {/* Backdrop: mouse users can click outside to close; keyboard users use Escape or the close button. */}
      <div className="absolute inset-0" aria-hidden="true" onMouseDown={() => onClose?.()} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? headingId : labelledBy}
        tabIndex={-1}
        className={clsx(
          'relative bg-white rounded-2xl shadow-pop w-full animate-popIn max-h-[90vh] flex flex-col outline-none',
          width
        )}
      >
        <div
          className={clsx(
            'flex items-center gap-3 px-5',
            hasTitle ? 'justify-between py-4 border-b border-slate-100' : 'justify-end pt-3 -mb-3'
          )}
        >
          {hasTitle && (
            <h2 id={headingId} className="text-base font-semibold text-slate-800">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-400 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto thin-scroll">{children}</div>
      </div>
    </div>
  );
}
