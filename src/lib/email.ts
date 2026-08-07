import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export function getMailFrom(): string {
  return process.env.RESEND_FROM?.trim() || "Solidarité Plus <onboarding@resend.dev>";
}

export async function sendOtpEmail(input: {
  to: string;
  code: string;
  purpose: "password_setup" | "login_2fa" | "email_verify";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) {
    // Dev fallback : log le code si Resend n’est pas configuré
    console.info(`[email:dev] OTP ${input.purpose} → ${input.to} : ${input.code}`);
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Envoi email non configuré (RESEND_API_KEY)." };
    }
    return { ok: true };
  }

  const titles = {
    password_setup: "Confirmation — nouveau mot de passe",
    login_2fa: "Code de connexion (2FA)",
    email_verify: "Confirmation de votre email",
  } as const;

  try {
    const { error } = await resend.emails.send({
      from: getMailFrom(),
      to: input.to,
      subject: `${titles[input.purpose]} · Solidarité Plus`,
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1D2D50">
          <p style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#D09C79;font-weight:700">Solidarité Plus</p>
          <h1 style="font-size:22px;margin:12px 0 8px">${titles[input.purpose]}</h1>
          <p style="color:#5c6b7a;font-size:14px;line-height:1.5">Voici votre code à usage unique. Il expire dans 10 minutes.</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:.25em;margin:24px 0;text-align:center">${input.code}</p>
          <p style="color:#5c6b7a;font-size:12px">Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
        </div>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Envoi impossible." };
  }
}
