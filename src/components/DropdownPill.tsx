'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { usePresence } from '@/lib/use-presence';
import { cn } from '@/lib/utils';

export interface DropdownPillOption {
  value: string;
  label: string;
  badge?: string;
}

interface DropdownPillProps {
  label?: string;
  value: string;
  options: DropdownPillOption[];
  onChange: (value: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownPill({
  label,
  value,
  options,
  onChange,
  align = 'left',
  className,
}: DropdownPillProps) {
  const [open, setOpen] = useState(false);
  const { present, exiting } = usePresence(open, 150);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const selected = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('kino-dropdown relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={present ? menuId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'kino-dropdown__trigger inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition',
          open
            ? 'border-[#e50935] bg-[#e50935]/15 text-[#FAFAFA]'
            : 'border-white/[0.1] bg-[#151517] text-[#FAFAFA] hover:border-[#e50935]/45'
        )}
      >
        {label && (
          <span className="text-[#71717A]">{label}:</span>
        )}
        <span className="max-w-[160px] truncate font-semibold text-[#e4e4e7]">
          {selected?.label || 'Select'}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-[#fb5272] transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {present && (
        <div
          id={menuId}
          role="listbox"
          aria-label={label || 'Filter options'}
          aria-hidden={exiting || undefined}
          inert={exiting}
          data-state={exiting ? 'closed' : 'open'}
          className={cn(
            'kino-dropdown__menu absolute z-40 mt-2 max-h-72 min-w-[210px] overflow-y-auto rounded-lg border border-white/[0.1] bg-[#151517]/95 p-1.5 shadow-2xl backdrop-blur-xl',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  triggerRef.current?.focus({ preventScroll: true });
                }}
                className={cn(
                  'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition',
                  isSelected
                    ? 'bg-[#e50935]/15 font-semibold text-[#e4e4e7]'
                    : 'text-[#A1A1AA] hover:bg-white/[0.05] hover:text-[#FAFAFA]'
                )}
              >
                <span className="truncate">{opt.label}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {opt.badge && (
                    <span className="text-[10px] text-[#71717A]">{opt.badge}</span>
                  )}
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#fb5272]" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
