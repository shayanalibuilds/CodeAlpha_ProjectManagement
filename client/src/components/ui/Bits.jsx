import { Loader2 } from 'lucide-react';

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin text-brand-500 ${className}`} />;
}

export function FullPageSpinner({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-100">
      <Spinner className="w-7 h-7" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center mb-4">
          <Icon size={26} />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      {hint && <p className="text-sm text-slate-400 mt-1 max-w-sm">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
