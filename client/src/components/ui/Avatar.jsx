import { avatarColor, initials } from '../../lib/constants';
import clsx from 'clsx';

export default function Avatar({ name = '?', size = 'md', className }) {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
  };
  return (
    <div
      title={name}
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0 select-none',
        avatarColor(name),
        sizes[size],
        className
      )}
    >
      {initials(name) || '?'}
    </div>
  );
}
