import * as crypto from 'crypto';

export function buildVnpayUrl(
  params: Record<string, string | number | undefined | null>,
  secretKey: string,
  baseUrl: string
): string {
  const searchParams = new URLSearchParams();
  const sortedKeys = Object.keys(params).sort();

  for (const key of sortedKeys) {
    const val = params[key];
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val));
    }
  }

  const signData = searchParams.toString();
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  searchParams.append('vnp_SecureHash', signed);
  return `${baseUrl}?${searchParams.toString()}`;
}

export function verifyVnpaySignature(
  queryParams: Record<string, string | number | undefined | null>,
  secretKey: string
): boolean {
  const secureHash = queryParams['vnp_SecureHash'];
  if (!secureHash) return false;

  const searchParams = new URLSearchParams();
  const sortedKeys = Object.keys(queryParams).sort();

  for (const key of sortedKeys) {
    if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
      const val = queryParams[key];
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    }
  }

  const signData = searchParams.toString();
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  const hashBuf = Buffer.from(String(secureHash).toLowerCase(), 'utf-8');
  const signBuf = Buffer.from(signed.toLowerCase(), 'utf-8');
  if (hashBuf.length !== signBuf.length) return false;

  return crypto.timingSafeEqual(hashBuf, signBuf);
}

export function formatVnpayDate(date: Date = new Date()): string {
  // Offset 7 hours for UTC+7 (Vietnam Timezone)
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = vnTime.getUTCFullYear();
  const mm = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vnTime.getUTCDate()).padStart(2, '0');
  const hh = String(vnTime.getUTCHours()).padStart(2, '0');
  const min = String(vnTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(vnTime.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}
