'use client';

import { useMemo } from 'react';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
  TimeField,
} from 'react-aria-components';
import type { DateValue, TimeValue } from 'react-aria-components';
import { parseDate, parseTime } from '@internationalized/date';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

type FieldVariant = 'field' | 'cell' | 'compact';

type DashDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  variant?: FieldVariant;
};

type DashTimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  variant?: FieldVariant;
  isDisabled?: boolean;
};

function parseDateValue(value: string) {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

function parseTimeValue(value: string) {
  if (!value) return null;
  try {
    return parseTime(value.slice(0, 5));
  } catch {
    return null;
  }
}

function dateToInputValue(value: DateValue | null) {
  return value ? value.toString().slice(0, 10) : '';
}

function timeToInputValue(value: TimeValue | null) {
  return value ? value.toString().slice(0, 5) : '';
}

function formatTimeLabel(value: TimeValue) {
  const date = new Date(1970, 0, 1, value.hour, value.minute);
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const fieldShellClass = 'flex min-h-[42px] w-full items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus-within:ring-primary-900/40';
const cellShellClass = 'mx-auto flex h-7 w-[90%] min-w-[88px] items-center justify-center rounded-sm border-0 bg-transparent px-1 py-0 text-[12px] leading-tight text-gray-900 outline-none transition focus-within:bg-white/70 dark:text-gray-100 dark:focus-within:bg-slate-900/40';
const compactShellClass = 'flex h-9 min-h-9 w-full items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-[12px] text-gray-900 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus-within:ring-blue-900/40';

function shellClass(variant: FieldVariant, className?: string) {
  return clsx(variant === 'cell' ? cellShellClass : variant === 'compact' ? compactShellClass : fieldShellClass, className);
}

function segmentClass(variant: FieldVariant) {
  return ({ isFocused, isPlaceholder, type }: any) => clsx(
    'tabular-nums outline-none',
    type === 'literal' ? 'px-0 text-gray-400 dark:text-gray-500' : 'rounded px-0.5',
    variant === 'cell' || variant === 'compact' ? 'text-[12px]' : 'text-sm',
    isPlaceholder && 'text-gray-400 dark:text-gray-500',
    isFocused && 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
  );
}

export function DashTimeField({
  value,
  onChange,
  ariaLabel = 'Time',
  className,
  variant = 'field',
  isDisabled = false,
}: DashTimeFieldProps) {
  const timeValue = useMemo(() => parseTimeValue(value), [value]);

  return (
    <TimeField
      aria-label={ariaLabel}
      value={timeValue}
      onChange={(nextValue) => onChange(timeToInputValue(nextValue))}
      hourCycle={12}
      granularity="minute"
      shouldForceLeadingZeros
      isDisabled={isDisabled}
      className={clsx('w-full', isDisabled && 'opacity-60')}
    >
      <DateInput className={shellClass(variant, className)}>
        {(segment) => <DateSegment segment={segment} className={segmentClass(variant)} />}
      </DateInput>
    </TimeField>
  );
}

export function DashDatePicker({
  value,
  onChange,
  ariaLabel = 'Date',
  className,
  variant = 'field',
}: DashDatePickerProps) {
  const dateValue = useMemo(() => parseDateValue(value), [value]);

  return (
    <DatePicker
      aria-label={ariaLabel}
      value={dateValue}
      onChange={(nextValue) => onChange(dateToInputValue(nextValue))}
      granularity="day"
      shouldForceLeadingZeros
      className="w-full"
    >
      <Group className={shellClass(variant, clsx('gap-2', className))}>
        <DateInput className="flex min-w-0 flex-1 items-center gap-0.5">
          {(segment) => <DateSegment segment={segment} className={segmentClass(variant)} />}
        </DateInput>
        <Button className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-md text-gray-500 outline-none transition hover:bg-gray-100 hover:text-gray-900 focus-visible:bg-blue-50 focus-visible:text-blue-700 dark:text-gray-300 dark:hover:bg-slate-600 dark:hover:text-white',
          variant === 'compact' ? 'h-6 w-6' : 'h-7 w-7',
        )}>
          <CalendarDays className={variant === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </Button>
      </Group>
      <Popover
        placement="bottom start"
        offset={8}
        className={({ isEntering, isExiting }) => clsx(
          'z-50 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900',
          isEntering && 'animate-in fade-in zoom-in-95 duration-150',
          isExiting && 'animate-out fade-out zoom-out-95 duration-100',
        )}
      >
        <Dialog className="outline-none">
          <Calendar className="w-[292px]">
            <header className="mb-3 flex items-center justify-between gap-2">
              <Button
                slot="previous"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 outline-none transition hover:bg-gray-50 hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-blue-300 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Heading className="text-sm font-bold text-gray-900 dark:text-white" />
              <Button
                slot="next"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 outline-none transition hover:bg-gray-50 hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-blue-300 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </header>
            <CalendarGrid className="w-full border-separate border-spacing-1">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="h-7 text-center text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={({ isDisabled, isFocused, isOutsideMonth, isSelected, isToday }) => clsx(
                      'h-9 w-9 rounded-md text-center text-sm font-semibold outline-none transition',
                      isOutsideMonth && 'text-gray-300 dark:text-gray-700',
                      isToday && !isSelected && 'text-blue-700 ring-1 ring-blue-200 dark:text-blue-300 dark:ring-blue-800',
                      isSelected && 'bg-blue-600 text-white shadow-sm dark:bg-blue-500',
                      !isSelected && !isOutsideMonth && 'text-gray-800 hover:bg-blue-50 dark:text-gray-100 dark:hover:bg-slate-800',
                      isFocused && 'ring-2 ring-blue-300',
                      isDisabled && 'cursor-not-allowed opacity-40',
                    )}
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
  );
}

export function DashTimeDisplay({ value }: { value?: string | null }) {
  const timeValue = parseTimeValue(value || '');
  if (!timeValue) return <span>--</span>;

  return (
    <span className="whitespace-nowrap tabular-nums">{formatTimeLabel(timeValue)}</span>
  );
}
