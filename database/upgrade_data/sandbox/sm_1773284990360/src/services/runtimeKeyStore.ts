import fs from 'node:fs';
import path from 'node:path';
import { UPGRADE_DATA_DIR } from '../config.js';

const KEY_FILE = path.join(UPGRADE_DATA_DIR, 'runtime_api_keys.json');

export type RuntimeProvider = 'groq' | 'openrouter' | 'gemini' | 'tavily';

export interface RuntimeProviderKeys {
  groq_api_keys: string[];
  openrouter_api_keys: string[];
  openrouter_models: string[];
  gemini_api_keys: string[];
  tavily_api_keys: string[];
  updated_at: string;
}

function normalize(keys: string[]): string[] {
  return Array.from(new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean)));
}

function emptyStore(): RuntimeProviderKeys {
  return {
    groq_api_keys: [],
    openrouter_api_keys: [],
    openrouter_models: [],
    gemini_api_keys: [],
    tavily_api_keys: [],
    updated_at: new Date().toISOString(),
  };
}

function readStore(): RuntimeProviderKeys | null {
  if (!fs.existsSync(KEY_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')) as Partial<RuntimeProviderKeys>;
    return {
      groq_api_keys: normalize(parsed.groq_api_keys || []),
      openrouter_api_keys: normalize(parsed.openrouter_api_keys || []),
      openrouter_models: normalize(parsed.openrouter_models || []),
      gemini_api_keys: normalize(parsed.gemini_api_keys || []),
      tavily_api_keys: normalize(parsed.tavily_api_keys || []),
      updated_at: String(parsed.updated_at || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

function writeStore(data: RuntimeProviderKeys): RuntimeProviderKeys {
  const next: RuntimeProviderKeys = {
    groq_api_keys: normalize(data.groq_api_keys),
    openrouter_api_keys: normalize(data.openrouter_api_keys),
    openrouter_models: normalize(data.openrouter_models),
    gemini_api_keys: normalize(data.gemini_api_keys),
    tavily_api_keys: normalize(data.tavily_api_keys),
    updated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function getRuntimeProviderKeys(fallbacks: {
  groq_api_keys?: string[];
  openrouter_api_keys?: string[];
  openrouter_models?: string[];
  gemini_api_keys?: string[];
  tavily_api_keys?: string[];
}): RuntimeProviderKeys {
  const stored = readStore();
  const base = stored || emptyStore();
  return {
    groq_api_keys: base.groq_api_keys.length ? base.groq_api_keys : normalize(fallbacks.groq_api_keys || []),
    openrouter_api_keys: base.openrouter_api_keys.length ? base.openrouter_api_keys : normalize(fallbacks.openrouter_api_keys || []),
    openrouter_models: base.openrouter_models.length ? base.openrouter_models : normalize(fallbacks.openrouter_models || []),
    gemini_api_keys: base.gemini_api_keys.length ? base.gemini_api_keys : normalize(fallbacks.gemini_api_keys || []),
    tavily_api_keys: base.tavily_api_keys.length ? base.tavily_api_keys : normalize(fallbacks.tavily_api_keys || []),
    updated_at: base.updated_at,
  };
}

export function setRuntimeProviderKeys(next: Partial<RuntimeProviderKeys>): RuntimeProviderKeys {
  const current = readStore() || emptyStore();
  return writeStore({
    groq_api_keys: next.groq_api_keys ? normalize(next.groq_api_keys) : current.groq_api_keys,
    openrouter_api_keys: next.openrouter_api_keys ? normalize(next.openrouter_api_keys) : current.openrouter_api_keys,
    openrouter_models: next.openrouter_models ? normalize(next.openrouter_models) : current.openrouter_models,
    gemini_api_keys: next.gemini_api_keys ? normalize(next.gemini_api_keys) : current.gemini_api_keys,
    tavily_api_keys: next.tavily_api_keys ? normalize(next.tavily_api_keys) : current.tavily_api_keys,
    updated_at: current.updated_at,
  });
}

export function maskedKeys(keys: string[]): string[] {
  return normalize(keys).map((k) => {
    if (k.length <= 12) return '***masked***';
    return `${k.slice(0, 8)}...${k.slice(-4)}`;
  });
}

// Backward compatible helpers used in existing code paths
export function getRuntimeGroqKeys(fallback: string[]): string[] {
  return getRuntimeProviderKeys({ groq_api_keys: fallback }).groq_api_keys;
}

export function setRuntimeGroqKeys(keys: string[]): string[] {
  return setRuntimeProviderKeys({ groq_api_keys: keys }).groq_api_keys;
}

export function maskedGroqKeys(keys: string[]): string[] {
  return maskedKeys(keys);
}
