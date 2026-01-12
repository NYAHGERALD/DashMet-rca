/**
 * Date utility functions that properly handle timezone conversion
 * All dates from the server are in UTC and need to be displayed in the user's local timezone
 */

/**
 * Format a date string to a localized date and time string
 * Uses the browser's timezone automatically
 */
export function formatDateTime(dateString: string | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    // This ensures the browser's timezone is used
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  
  return date.toLocaleString(undefined, { ...defaultOptions, ...options });
}

/**
 * Format a date string to a localized date string (no time)
 * Uses the browser's timezone automatically
 */
export function formatDate(dateString: string | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    // This ensures the browser's timezone is used
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  
  return date.toLocaleDateString(undefined, { ...defaultOptions, ...options });
}

/**
 * Format a date string to a localized time string (no date)
 * Uses the browser's timezone automatically
 */
export function formatTime(dateString: string | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    // This ensures the browser's timezone is used
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  
  return date.toLocaleTimeString(undefined, { ...defaultOptions, ...options });
}

/**
 * Format a date for display with relative time (e.g., "Today 2:30 PM", "Yesterday 10:00 AM")
 * Uses the browser's timezone automatically
 */
export function formatRelativeDateTime(dateString: string | Date): string {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = formatTime(date);
  
  if (dateOnly.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  } else if (dateOnly.getTime() === yesterday.getTime()) {
    return `Yesterday at ${timeStr}`;
  } else {
    return formatDateTime(date);
  }
}

/**
 * Format a date for input fields (YYYY-MM-DD format in local timezone)
 */
export function formatDateForInput(dateString: string | Date): string {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return '';
  
  // Get local date components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format a datetime for input fields (YYYY-MM-DDTHH:mm format in local timezone)
 */
export function formatDateTimeForInput(dateString: string | Date): string {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return '';
  
  // Get local date/time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get the user's current timezone name
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format with explicit timezone display
 */
export function formatDateTimeWithTimezone(dateString: string | Date): string {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Check for invalid date
  if (isNaN(date.getTime())) return '';
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  
  return date.toLocaleString(undefined, options);
}
