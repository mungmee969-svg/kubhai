"use client";

import { useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  autoFocus,
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setAt(index: number, char: string) {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join("").slice(0, length));
  }

  function handlePaste(raw: string) {
    const cleaned = raw.replace(/\D/g, "").slice(0, length);
    if (!cleaned) return;
    onChange(cleaned);
    const focusIdx = Math.min(cleaned.length, length - 1);
    refs.current[focusIdx]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="รหัส OTP 6 หลัก">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`หลักที่ ${index + 1}`}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          value={digit}
          className="h-12 w-11 rounded-xl border border-[color:var(--store-line,#E5E7EB)] bg-white text-center text-lg font-semibold text-[color:var(--store-ink,#0F1724)] outline-none focus:border-[color:var(--store-accent,#C4A35A)] focus:ring-2 focus:ring-[color:var(--store-accent,#C4A35A)]/30 sm:h-14 sm:w-12"
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (raw.length > 1) {
              handlePaste(raw);
              return;
            }
            setAt(index, raw.slice(-1));
            if (raw && index < length - 1) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            handlePaste(e.clipboardData.getData("text"));
          }}
        />
      ))}
    </div>
  );
}
