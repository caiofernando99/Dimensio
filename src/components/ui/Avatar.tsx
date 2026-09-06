import React, { useState } from 'react';

export interface AvatarProps {
  src?: string | null;
  photoUrl?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs font-bold',
  lg: 'w-10 h-10 text-sm font-bold',
  xl: 'w-14 h-14 text-base font-extrabold',
};

// Generates stable background color from name
function getInitialsColor(name: string): string {
  if (!name) return 'bg-slate-500 text-white';
  const colors = [
    'bg-blue-600 text-white',
    'bg-indigo-600 text-white',
    'bg-emerald-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white',
    'bg-purple-600 text-white',
    'bg-teal-600 text-white',
    'bg-cyan-600 text-white',
    'bg-violet-600 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  photoUrl,
  name,
  size = 'md',
  className = '',
  alt,
}) => {
  const [hasError, setHasError] = useState(false);
  const sizeClass = sizeClasses[size];
  const initials = getInitials(name);
  const colorClass = getInitialsColor(name);
  const effectiveSrc = src || photoUrl;

  if (effectiveSrc && !hasError) {
    return (
      <img
        src={effectiveSrc}
        alt={alt || name}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 ring-1 ring-[var(--line)] shadow-xs ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center shrink-0 font-bold select-none shadow-xs ring-1 ring-white/10 ${className}`}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  );
};
