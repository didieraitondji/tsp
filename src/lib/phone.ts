/** Indicatif Bénin — tous les numéros plateforme sont au format +229 + 10 chiffres. */
export const BENIN_PREFIX = "+229";
export const BENIN_LOCAL_LENGTH = 10;

/** Chiffres locaux (sans 229), tronqués à 10 pour l’affichage des champs. */
export function extractLocalPhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("229")) digits = digits.slice(3);
  return digits.slice(0, BENIN_LOCAL_LENGTH);
}

/**
 * Normalise vers +229XXXXXXXXXX (exactement 10 chiffres locaux).
 * Retourne null si le numéro n’a pas exactement 10 chiffres après +229.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("229")) digits = digits.slice(3);
  if (digits.length !== BENIN_LOCAL_LENGTH) return null;
  if (!/^\d{10}$/.test(digits)) return null;
  return `${BENIN_PREFIX}${digits}`;
}

export function isValidBeninPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return Boolean(na && nb && na === nb);
}

export const beninPhoneSchemaMessage =
  "Numéro béninois requis : +229 suivi de exactement 10 chiffres";
