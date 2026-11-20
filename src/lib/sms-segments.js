const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

export function smsSegments(text = "") {
  const chars = Array.from(text);
  let unicode = false;
  let gsmLen = 0;
  for (const c of chars) {
    if (GSM_BASIC.includes(c)) gsmLen += 1;
    else if (GSM_EXT.includes(c)) gsmLen += 2;
    else { unicode = true; break; }
  }
  const length = unicode ? text.length : gsmLen; // UTF-16 units for unicode
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const segments = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi);
  return { length, unicode, single, segments };
}
