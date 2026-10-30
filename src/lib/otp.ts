import { createHmac } from 'node:crypto';

export function otpDigest(email: string, code: string) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return createHmac('sha256', process.env.JWT_SECRET).update(`professor-otp-v1:${email}:${code}`).digest('hex');
}

export function validEmail(email: string) {
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email);
}
