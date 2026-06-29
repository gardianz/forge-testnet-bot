import CryptoJS from 'crypto-js';

export function encryptJson(obj: unknown, key: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(obj), key).toString();
}

export function decryptJson(cipher: string, key: string): unknown {
  const bytes = CryptoJS.AES.decrypt(cipher, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}
