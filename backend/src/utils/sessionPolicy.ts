const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_IDLE_TIMEOUT_MS = parsePositiveInt(
  process.env.SESSION_IDLE_TIMEOUT_MS,
  60 * 60 * 1000
);
const SYSTEM_ADMIN_IDLE_TIMEOUT_MS = parsePositiveInt(
  process.env.SYSTEM_ADMIN_IDLE_TIMEOUT_MS,
  15 * 60 * 1000
);
const DEFAULT_ABSOLUTE_TIMEOUT_MS = parsePositiveInt(
  process.env.SESSION_ABSOLUTE_TIMEOUT_MS,
  24 * 60 * 60 * 1000
);
const SYSTEM_ADMIN_ABSOLUTE_TIMEOUT_MS = parsePositiveInt(
  process.env.SYSTEM_ADMIN_ABSOLUTE_TIMEOUT_MS,
  12 * 60 * 60 * 1000
);

export const getIdleTimeoutMsForRole = (role?: string): number =>
  role === 'SYSTEM_ADMIN' ? SYSTEM_ADMIN_IDLE_TIMEOUT_MS : DEFAULT_IDLE_TIMEOUT_MS;

export const getAbsoluteSessionTimeoutMsForRole = (role?: string): number =>
  role === 'SYSTEM_ADMIN' ? SYSTEM_ADMIN_ABSOLUTE_TIMEOUT_MS : DEFAULT_ABSOLUTE_TIMEOUT_MS;

export const isSessionAbsoluteExpired = (
  sessionCreatedAt: Date,
  role?: string,
  now: Date = new Date()
): boolean =>
  now.getTime() - new Date(sessionCreatedAt).getTime() >= getAbsoluteSessionTimeoutMsForRole(role);

