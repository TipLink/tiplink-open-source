export const VERIFY_EMAIL_ENDPOINT =
  process.env.NEXT_PUBLIC_VERIFY_EMAIL_ENDPOINT_OVERRIDE ||
  "https://email-verify.tiplink.tech/verify-email";

interface VerifyEmailRes {
  validFormat: boolean;
  validSmtp: boolean;
  validMx: boolean;
}

export async function isEmailValid(emailAddress: string): Promise<boolean> {
  const res = await fetch(VERIFY_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ emailAddress }),
  });

  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }

  const { validFormat, validSmtp, validMx }: VerifyEmailRes = await res.json();
  return validFormat && validSmtp && validMx;
}
