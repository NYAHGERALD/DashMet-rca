'use client';

import { useState, useCallback } from 'react';
import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

// Supported countries
const COUNTRIES: { code: CountryCode; name: string; dial: string; flag: string }[] = [
  { code: 'US', name: 'USA',    dial: '+1',  flag: '🇺🇸' },
  { code: 'GB', name: 'UK',     dial: '+44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', dial: '+1',  flag: '🇨🇦' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
];

interface PhoneInputProps {
  /** Displayed formatted value (e.g. "(469) 716-1494") */
  displayValue: string;
  /** E.164 value stored in form (e.g. "+14697161494") */
  e164Value: string;
  /** Called with (displayFormatted, e164Raw) */
  onChange: (display: string, e164: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export default function PhoneInput({
  displayValue,
  onChange,
  placeholder,
  className = '',
  label,
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>('US');

  const formatAndEmit = useCallback(
    (raw: string, cc: CountryCode) => {
      // Strip everything except digits
      const digits = raw.replace(/\D/g, '');
      if (!digits) {
        onChange('', '');
        return;
      }

      // Format as-you-type for the selected country
      const formatter = new AsYouType(cc);
      const formatted = formatter.input(digits);

      // Build E.164
      const countryDial = COUNTRIES.find((c) => c.code === cc)?.dial ?? '+1';
      const parsed = parsePhoneNumberFromString(digits, cc);
      const e164 = parsed?.format('E.164') ?? `${countryDial}${digits}`;

      onChange(formatted, e164);
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    formatAndEmit(e.target.value, country);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cc = e.target.value as CountryCode;
    setCountry(cc);
    // Re-format existing digits for the new country
    const digits = displayValue.replace(/\D/g, '');
    if (digits) {
      formatAndEmit(digits, cc);
    }
  };

  const selected = COUNTRIES.find((c) => c.code === country);

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="flex">
        <select
          value={country}
          onChange={handleCountryChange}
          title="Country code"
          className="w-24 px-2 py-2 text-sm border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white shrink-0"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.dial}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder ?? selected?.name ?? 'Phone number'}
          className={`flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${className}`}
        />
      </div>
    </div>
  );
}
