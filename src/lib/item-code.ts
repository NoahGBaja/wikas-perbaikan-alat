export const ITEM_CODE_BASE_DIGITS = 10;
export const MAX_NUP_DIGITS = 3;

const COMPLETE_ITEM_CODE_PATTERN =
  /^\d\.\d{2}\.\d{2}\.\d{2}\.\d{3}\.\d{1,3}$/;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatDigitGroups(digits: string) {
  const sizes = [1, 2, 2, 2, 3, MAX_NUP_DIGITS];
  const groups: string[] = [];
  let offset = 0;

  for (const size of sizes) {
    const group = digits.slice(offset, offset + size);

    if (!group) break;
    groups.push(group);
    offset += size;
  }

  return groups.join(".");
}

export function formatItemCodeInput(value: string) {
  return formatDigitGroups(
    digitsOnly(value).slice(0, ITEM_CODE_BASE_DIGITS + MAX_NUP_DIGITS),
  );
}

export function getNupFromItemCode(value: string) {
  return digitsOnly(value).slice(
    ITEM_CODE_BASE_DIGITS,
    ITEM_CODE_BASE_DIGITS + MAX_NUP_DIGITS,
  );
}

export function normalizeStoredItemCode(code: string, nup: string) {
  if (COMPLETE_ITEM_CODE_PATTERN.test(code.trim())) {
    return formatItemCodeInput(code);
  }

  const baseCode = digitsOnly(code).slice(0, ITEM_CODE_BASE_DIGITS);
  const normalizedNup = digitsOnly(nup).slice(0, MAX_NUP_DIGITS);

  return formatDigitGroups(`${baseCode}${normalizedNup}`);
}

export function isValidItemCode(value: string) {
  return COMPLETE_ITEM_CODE_PATTERN.test(value.trim());
}
