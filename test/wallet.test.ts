import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateAccounts } from '../src/wallet.ts';

const tmp = () => join(tmpdir(), `accts-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

describe('generateAccounts', () => {
  it('creates N accounts with derived H160 + SS58 and writes the file', async () => {
    const p = tmp();
    try {
      const info = await generateAccounts(3, p, 42);
      expect(info).toHaveLength(3);
      expect(info.map((i) => i.id)).toEqual(['acc1', 'acc2', 'acc3']);
      for (const i of info) {
        expect(i.h160).toMatch(/^0x[0-9a-fA-F]{40}$/);
        expect(i.ss58.length).toBeGreaterThan(40);
        expect(i.mirrorSs58.length).toBeGreaterThan(40);
      }
      const file = JSON.parse(readFileSync(p, 'utf8'));
      expect(file).toHaveLength(3);
      expect(file[0].mnemonic.split(' ')).toHaveLength(12); // ready-to-use phrase
    } finally {
      if (existsSync(p)) rmSync(p);
    }
  });

  it('appends to an existing array, continuing the accN numbering', async () => {
    const p = tmp();
    writeFileSync(p, JSON.stringify([{ id: 'acc1', mnemonic: 'x' }]));
    try {
      const info = await generateAccounts(2, p, 42);
      expect(info.map((i) => i.id)).toEqual(['acc2', 'acc3']);
      expect(JSON.parse(readFileSync(p, 'utf8'))).toHaveLength(3);
    } finally {
      if (existsSync(p)) rmSync(p);
    }
  });

  it('refuses to append to a non-array (encrypted) file', async () => {
    const p = tmp();
    writeFileSync(p, 'U2FsdGVkX1+encryptedblob==');
    try {
      await expect(generateAccounts(1, p, 42)).rejects.toThrow(/encrypted|plaintext/i);
    } finally {
      if (existsSync(p)) rmSync(p);
    }
  });
});
