// How many SMS a message is billed as. Plain text uses the GSM 7-bit alphabet: 160
// characters in one SMS, 153 per part when longer. A single character outside it
// (an emoji, "•", curly quotes) switches the whole message to UCS-2: 70 characters,
// or 67 per part. Characters from the GSM extension table (€ [ ] { } ~ ^ | \) count twice.

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€";

export function smsParts(text: string) {
  const chars = [...text];
  const gsm = chars.every((c) => GSM_BASIC.includes(c) || GSM_EXTENDED.includes(c));
  if (gsm) {
    const length = chars.reduce((n, c) => n + (GSM_EXTENDED.includes(c) ? 2 : 1), 0);
    return { length, encoding: "GSM" as const, parts: length <= 160 ? 1 : Math.ceil(length / 153) };
  }
  const length = chars.length;
  return { length, encoding: "UCS-2" as const, parts: length <= 70 ? 1 : Math.ceil(length / 67) };
}
