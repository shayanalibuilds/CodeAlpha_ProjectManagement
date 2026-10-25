export const STATUSES = [
  { key: 'TODO', label: 'To-Do', dot: 'bg-slate-400', header: 'text-slate-600' },
  { key: 'IN_PROGRESS', label: 'In-Progress', dot: 'bg-amber-400', header: 'text-amber-600' },
  { key: 'DONE', label: 'Done', dot: 'bg-brand-500', header: 'text-brand-600' },
];

export const PRIORITIES = {
  LOW: { label: 'Low', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  MEDIUM: { label: 'Medium', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  HIGH: { label: 'High', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  URGENT: { label: 'Urgent', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

export const PROJECT_COLORS = {
  emerald: { bar: 'bg-brand-500', soft: 'bg-brand-50 text-brand-700', ring: 'ring-brand-300' },
  amber: { bar: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700', ring: 'ring-amber-300' },
  rose: { bar: 'bg-rose-500', soft: 'bg-rose-50 text-rose-700', ring: 'ring-rose-300' },
  violet: { bar: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700', ring: 'ring-violet-300' },
  teal: { bar: 'bg-teal-500', soft: 'bg-teal-50 text-teal-700', ring: 'ring-teal-300' },
  orange: { bar: 'bg-orange-500', soft: 'bg-orange-50 text-orange-700', ring: 'ring-orange-300' },
};

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-600',
  'bg-fuchsia-500',
];

export function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}
