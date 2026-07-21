export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_REQUIREMENT_TEXT =
  "Kata sandi minimal 8 karakter dan harus mengandung huruf, angka, dan simbol.";

export function validatePasswordStrength(password: string) {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push("Kata sandi minimal 8 karakter.");
  }

  if (!/[A-Za-z]/.test(password)) {
    errors.push("Kata sandi harus mengandung huruf.");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Kata sandi harus mengandung angka.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Kata sandi harus mengandung simbol.");
  }

  return errors;
}
