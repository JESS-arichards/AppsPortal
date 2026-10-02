import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_BRANDING, DEFAULT_HOME_CONTENT, DEFAULT_LOGIN_CONTENT } from '../shared/defaults.js';

const schema = fs.readFileSync(path.resolve(__dirname, '../database/schema.sql'), 'utf8').replace(/\r\n/g, '\n');

/** Column -> DEFAULT string literal (or null for nullable columns without a default) for one table. */
function tableDefaults(table: string): Record<string, string | null> {
  const block = schema.match(new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n    \\);`))?.[1];
  if (!block) throw new Error(`Table ${table} not found in schema.sql`);
  const result: Record<string, string | null> = {};
  const column = /^ {8}(\w+) NVARCHAR\(\w+\) (NOT NULL DEFAULT '((?:[^']|'')*)'|NULL)/gm;
  for (const m of block.matchAll(column)) {
    result[m[1]] = m[3] !== undefined ? m[3].replace(/''/g, "'") : null;
  }
  return result;
}

function contentFields(defaults: object): Record<string, unknown> {
  const { id: _id, updatedAt: _updatedAt, ...rest } = defaults as Record<string, unknown>;
  return rest;
}

describe('shared defaults match database/schema.sql', () => {
  it.each([
    ['PortalBranding', DEFAULT_BRANDING],
    ['PortalHomeContent', DEFAULT_HOME_CONTENT],
    ['PortalLoginContent', DEFAULT_LOGIN_CONTENT],
  ])('%s', (table, defaults) => {
    const columns = tableDefaults(table);
    const fields = contentFields(defaults);
    expect(Object.keys(columns).sort()).toEqual(Object.keys(fields).sort());
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'valuesJson') {
        expect(JSON.parse(columns[key]!)).toEqual(JSON.parse(value as string));
      } else {
        expect(columns[key], key).toBe(value ?? null);
      }
    }
  });
});
