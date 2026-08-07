/** Mot de passe temporaire attribué à la création d’un compte. */
export const DEFAULT_TEMP_PASSWORD = "TSP@2026";

export const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * 2FA email + OTP : désactivé tant qu’il n’y a pas de domaine / Resend en prod.
 * Remettre à true quand RESEND + domaine seront prêts.
 */
export const EMAIL_AUTH_FEATURES_ENABLED = false;
