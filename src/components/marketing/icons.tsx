/** Inline marketing icons — no emoji dependency. */
type IconProps = { className?: string };

export function IconCar({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 16h14v2.2a1 1 0 0 1-1 1h-1.2a1 1 0 0 1-1-1V16H8.2v2.2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V16Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 16 6.2 9.8A2 2 0 0 1 8.1 8.5h7.8a2 2 0 0 1 1.9 1.3L19.5 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="16" r="1.35" fill="currentColor" />
      <circle cx="16.5" cy="16" r="1.35" fill="currentColor" />
      <path d="M9 11.2h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlane({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.2 12.8 4.8 14.6l-.9-1.5 5.4-2.8L4.5 5.8l1.6-1.1 6.2 4.4 5.2-3.1a1.8 1.8 0 1 1 1.6 3.2l-5.2 2.2 1.5 7.1-1.7.6-2.5-6.3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPin({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconRoute({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6.5" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8.5 8.2c2.2 1.4 4.8 5.2 7 7.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M14 6.5h4.5V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconStore({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 5.5 5h13L20 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5 10.5V19h14v-8.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 19v-5h4v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlan({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5V7M16 3.5V7M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 14h3M8 17h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconSteps({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 17h5v-4h4V9h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5" cy="17" r="1.4" fill="currentColor" />
      <circle cx="10" cy="13" r="1.4" fill="currentColor" />
      <circle cx="14" cy="9" r="1.4" fill="currentColor" />
      <circle cx="19" cy="5.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
