import React, { useRef } from 'react';

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  label?: string;
}

export const PinInput: React.FC<PinInputProps> = ({
  value,
  onChange,
  length = 6,
  label = "6-Digit Secret PIN"
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCharChange = (index: number, char: string) => {
    // Only accept numeric digits
    if (!/^\d*$/.test(char)) return;

    const chars = value.split('');
    chars[index] = char.slice(-1); // Take last entered character
    const newVal = chars.join('').slice(0, length);
    onChange(newVal);

    // Auto-focus next input if a digit was entered
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasteData) {
      onChange(pasteData);
      const focusIndex = Math.min(pasteData.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
          {label}
        </label>
      )}
      <div className="flex justify-center gap-2 sm:gap-3">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleCharChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          />
        ))}
      </div>
    </div>
  );
};
