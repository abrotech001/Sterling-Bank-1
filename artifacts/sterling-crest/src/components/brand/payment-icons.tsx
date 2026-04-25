import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

export function CashAppIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="64" height="64" rx="14" fill="#00D632" />
      <path
        fill="#fff"
        d="M41.6 24.8c-.4.4-1 .4-1.4.1-1.6-1.3-3.7-2.1-5.7-2.1-1.7 0-3.4.6-3.4 2.2 0 1.6 1.8 2.1 3.9 2.9 3.7 1.3 6.7 2.9 6.7 6.7 0 4.1-3.2 6.9-8.5 7.3l-.5 2.4c-.1.6-.6 1-1.2 1H28c-.7 0-1.3-.6-1.1-1.4l.5-2.5c-2.3-.5-4.4-1.6-5.9-3-.4-.4-.4-1 0-1.4l1.6-1.6c.4-.4 1-.4 1.4 0 1.9 1.7 4.4 2.5 6.8 2.5 2.3 0 3.8-1 3.8-2.5 0-1.6-1.6-2.1-4.5-3.2-3.1-1.1-6-2.6-6-6.4 0-4.4 3.7-6.6 8.2-6.8l.4-2.4c.1-.6.6-1 1.2-1h3.2c.7 0 1.3.6 1.1 1.4l-.5 2.6c1.8.5 3.6 1.4 4.9 2.5.4.4.5 1 .1 1.4l-1.6 1.3z"
      />
    </svg>
  );
}

export function PayPalIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="64" height="64" rx="14" fill="#fff" />
      <path
        fill="#003087"
        d="M22.5 50.5h-5.4c-.6 0-1.1-.5-1-1.2L22.6 14c.1-.5.5-.9 1-.9h13.6c5.5 0 9.4 1.4 11.2 4.2 1.6 2.5 1.7 5.4.4 9.6-2.4 7.6-8 11.2-16.7 11.2h-4.4c-.5 0-1 .4-1 .9l-1.7 10.5c-.1.5-.6 1-1.5 1z"
      />
      <path
        fill="#009cde"
        d="M48.8 16.7c-.4 2.3-2.5 13.4-7.7 17.6-3.3 2.7-7.6 3.3-12.4 3.3h-3l-2.3 14.6c-.1.5.3 1 .8 1h7.4c.6 0 1.1-.4 1.2-1l1.6-9.9c.1-.6.6-1 1.2-1h3c8.6 0 14.5-3.5 16.4-12.4.8-3.5.4-6.5-1.5-8.6-.6-.7-1.4-1.3-2.3-1.7-.4-.2-1.1.5-2.4-1.9z"
      />
    </svg>
  );
}

export function VenmoIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="64" height="64" rx="14" fill="#3D95CE" />
      <path
        fill="#fff"
        d="M46.5 13c1.6 2.6 2.3 5.2 2.3 8.6 0 10.7-9.2 24.6-16.6 34.4H15.3l-6.8-40.5 14.8-1.4 3.6 28.9c3.4-5.5 7.5-14 7.5-19.9 0-3.2-.6-5.4-1.4-7.2L46.5 13z"
      />
    </svg>
  );
}

export function ZelleIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="64" height="64" rx="14" fill="#6D1ED4" />
      <path
        fill="#fff"
        d="M27.5 12h9c.6 0 1 .4 1 1v3.7h7.6c.6 0 1 .4 1 1v4.6c0 .2-.1.4-.2.6L26.7 45.3h17.7c.6 0 1 .4 1 1V51c0 .6-.4 1-1 1h-7.9V55c0 .6-.4 1-1 1h-9c-.6 0-1-.4-1-1v-3h-7c-.6 0-1-.4-1-1v-4.6c0-.2.1-.5.2-.6l19.1-22.3H19.5c-.6 0-1-.4-1-1v-4.7c0-.6.4-1 1-1h7v-3.8c0-.6.4-1 1-1z"
      />
    </svg>
  );
}

export function BankIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="64" height="64" rx="14" fill="#0F4C81" />
      <path fill="#fff" d="M32 10 12 22v3h40v-3L32 10zm-16 18v18h4V28h-4zm10 0v18h4V28h-4zm10 0v18h4V28h-4zm10 0v18h4V28h-4zM12 50v4h40v-4H12z" />
    </svg>
  );
}

export function BitcoinIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="64" height="64" rx="14" fill="#F7931A" />
      <path
        fill="#fff"
        d="M44.6 28.7c.6-3.9-2.4-6-6.5-7.4l1.3-5.3-3.2-.8-1.3 5.2c-.8-.2-1.7-.4-2.6-.6l1.3-5.2-3.2-.8-1.3 5.3c-.7-.2-1.3-.3-2-.5l-4.5-1.1-.9 3.4s2.4.6 2.4.6c1.3.3 1.6 1.2 1.5 1.9l-1.5 6c.1 0 .2.1.4.1l-.4-.1-2.1 8.4c-.2.4-.6 1-1.6.7 0 .1-2.4-.6-2.4-.6l-1.6 3.7 4.3 1c.8.2 1.6.4 2.3.6l-1.4 5.4 3.2.8 1.3-5.3c.9.2 1.7.5 2.6.7l-1.3 5.3 3.2.8 1.4-5.4c5.5 1 9.6.6 11.4-4.4 1.4-4-.1-6.3-3-7.8 2.1-.5 3.7-1.9 4.2-4.7zM37 38.6c-1 4-7.7 1.8-9.9 1.3l1.7-7c2.2.5 9.3 1.6 8.2 5.7zm1-9.9c-.9 3.7-6.5 1.8-8.4 1.3l1.6-6.4c1.8.5 7.7 1.3 6.8 5.1z"
      />
    </svg>
  );
}
