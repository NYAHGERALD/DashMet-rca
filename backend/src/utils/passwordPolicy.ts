const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  'qwerty123',
  'letmein123',
  'admin123',
  'welcome123',
  'changeme123',
  'dashmet123',
]);

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export function validatePasswordPolicy(
  password: string,
  userInputs: Array<string | null | undefined> = []
): string[] {
  const errors: string[] = [];
  const normalizedPassword = String(password || '');
  const lowerPassword = normalizedPassword.toLowerCase();

  if (normalizedPassword.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }

  if (normalizedPassword.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`);
  }

  if (!/[a-z]/.test(normalizedPassword)) {
    errors.push('Password must include a lowercase letter');
  }

  if (!/[A-Z]/.test(normalizedPassword)) {
    errors.push('Password must include an uppercase letter');
  }

  if (!/[0-9]/.test(normalizedPassword)) {
    errors.push('Password must include a number');
  }

  if (!/[^A-Za-z0-9]/.test(normalizedPassword)) {
    errors.push('Password must include a special character');
  }

  if (COMMON_WEAK_PASSWORDS.has(lowerPassword)) {
    errors.push('Password is too common');
  }

  for (const input of userInputs) {
    const normalizedInput = String(input || '').toLowerCase().trim();
    if (normalizedInput.length >= 3 && lowerPassword.includes(normalizedInput)) {
      errors.push('Password must not contain your personal details');
      break;
    }

    const emailLocalPart = normalizedInput.includes('@')
      ? normalizedInput.split('@')[0]
      : '';
    if (emailLocalPart.length >= 3 && lowerPassword.includes(emailLocalPart)) {
      errors.push('Password must not contain your email address');
      break;
    }
  }

  return errors;
}

export function assertPasswordPolicy(
  password: string,
  userInputs: Array<string | null | undefined> = []
) {
  const errors = validatePasswordPolicy(password, userInputs);
  if (errors.length > 0) {
    return errors[0];
  }
  return null;
}
