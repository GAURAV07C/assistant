import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function trimText(input, max = 220) {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
