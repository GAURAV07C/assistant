import fs from 'node:fs';
import path from 'node:path';
import { TTS_RATE, TTS_VOICE, VOICE_DATA_DIR } from '../../config.js';

export interface BuiltinVoice {
  id: string;
  label: string;
}

export interface CustomVoiceProfile {
  id: string;
  name: string;
  edge_voice: string;
  rate: string;
  sample_file?: string;
  created_at: string;
  updated_at: string;
}

interface VoiceSettingsStore {
  active_source: 'edge' | 'custom';
  active_voice_id: string;
  edge_voice: string;
  rate: string;
  updated_at: string;
}

const BUILTIN_VOICES: BuiltinVoice[] = [
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK)' },
  { id: 'en-US-AriaNeural', label: 'Aria (US)' },
  { id: 'en-US-GuyNeural', label: 'Guy (US)' },
  { id: 'en-IN-NeerjaNeural', label: 'Neerja (IN)' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat (IN)' },
  { id: 'hi-IN-MadhurNeural', label: 'Madhur (HI)' },
  { id: 'hi-IN-SwaraNeural', label: 'Swara (HI)' },
];

export class VoiceService {
  private settingsFile = path.join(VOICE_DATA_DIR, 'voice_settings.json');
  private profilesFile = path.join(VOICE_DATA_DIR, 'custom_voices.json');
  private samplesDir = path.join(VOICE_DATA_DIR, 'samples');

  constructor() {
    fs.mkdirSync(VOICE_DATA_DIR, { recursive: true });
    fs.mkdirSync(this.samplesDir, { recursive: true });
  }

  private now(): string {
    return new Date().toISOString();
  }

  private sanitizeId(input: unknown): string {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  private sanitizeRate(input: unknown): string {
    const rate = String(input || '').trim();
    if (!rate) return TTS_RATE;
    if (!/^[+-]?\d+%$/.test(rate)) return TTS_RATE;
    return rate;
  }

  private readSettings(): VoiceSettingsStore {
    if (!fs.existsSync(this.settingsFile)) {
      return {
        active_source: 'edge',
        active_voice_id: TTS_VOICE,
        edge_voice: TTS_VOICE,
        rate: TTS_RATE,
        updated_at: this.now(),
      };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')) as Partial<VoiceSettingsStore>;
      const edgeVoice = String(parsed.edge_voice || parsed.active_voice_id || TTS_VOICE);
      return {
        active_source: parsed.active_source === 'custom' ? 'custom' : 'edge',
        active_voice_id: String(parsed.active_voice_id || edgeVoice || TTS_VOICE),
        edge_voice: edgeVoice,
        rate: this.sanitizeRate(parsed.rate),
        updated_at: String(parsed.updated_at || this.now()),
      };
    } catch {
      return {
        active_source: 'edge',
        active_voice_id: TTS_VOICE,
        edge_voice: TTS_VOICE,
        rate: TTS_RATE,
        updated_at: this.now(),
      };
    }
  }

  private writeSettings(next: VoiceSettingsStore): void {
    fs.writeFileSync(this.settingsFile, JSON.stringify(next, null, 2), 'utf8');
  }

  private readProfiles(): CustomVoiceProfile[] {
    if (!fs.existsSync(this.profilesFile)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.profilesFile, 'utf8')) as { voices?: CustomVoiceProfile[] };
      return Array.isArray(parsed.voices) ? parsed.voices : [];
    } catch {
      return [];
    }
  }

  private writeProfiles(voices: CustomVoiceProfile[]): void {
    fs.writeFileSync(this.profilesFile, JSON.stringify({ voices }, null, 2), 'utf8');
  }

  listBuiltins(): BuiltinVoice[] {
    return BUILTIN_VOICES;
  }

  listCustom(): CustomVoiceProfile[] {
    return this.readProfiles().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  getPublicSettings(): {
    active_source: 'edge' | 'custom';
    active_voice_id: string;
    edge_voice: string;
    rate: string;
    builtins: BuiltinVoice[];
    custom_voices: CustomVoiceProfile[];
    updated_at: string;
  } {
    const settings = this.readSettings();
    return {
      ...settings,
      builtins: this.listBuiltins(),
      custom_voices: this.listCustom(),
    };
  }

  resolveRuntimeVoice(): { voice: string; rate: string; source: 'edge' | 'custom'; active_voice_id: string } {
    const settings = this.readSettings();
    if (settings.active_source === 'custom') {
      const profile = this.readProfiles().find((v) => v.id === settings.active_voice_id);
      if (profile) {
        return {
          voice: profile.edge_voice || settings.edge_voice || TTS_VOICE,
          rate: this.sanitizeRate(profile.rate || settings.rate),
          source: 'custom',
          active_voice_id: profile.id,
        };
      }
    }

    return {
      voice: settings.edge_voice || TTS_VOICE,
      rate: this.sanitizeRate(settings.rate),
      source: 'edge',
      active_voice_id: settings.edge_voice || TTS_VOICE,
    };
  }

  selectVoiceProfile(userId?: string): { voice: string; rate: string; source: 'edge' | 'custom'; active_voice_id: string; user_id: string } {
    const cfg = this.resolveRuntimeVoice();
    return {
      ...cfg,
      user_id: String(userId || 'default_user'),
    };
  }

  setActive(input: { active_source?: 'edge' | 'custom'; active_voice_id?: string; edge_voice?: string; rate?: string }): VoiceSettingsStore {
    const current = this.readSettings();
    const source = input.active_source === 'custom' ? 'custom' : 'edge';
    const rate = this.sanitizeRate(input.rate || current.rate);

    if (source === 'custom') {
      const targetId = this.sanitizeId(input.active_voice_id || current.active_voice_id);
      const profile = this.readProfiles().find((v) => v.id === targetId);
      if (!profile) throw new Error('Custom voice profile not found');

      const next: VoiceSettingsStore = {
        active_source: 'custom',
        active_voice_id: profile.id,
        edge_voice: profile.edge_voice,
        rate,
        updated_at: this.now(),
      };
      this.writeSettings(next);
      return next;
    }

    const edgeVoice = String(input.edge_voice || input.active_voice_id || current.edge_voice || TTS_VOICE).trim();
    const next: VoiceSettingsStore = {
      active_source: 'edge',
      active_voice_id: edgeVoice,
      edge_voice: edgeVoice,
      rate,
      updated_at: this.now(),
    };
    this.writeSettings(next);
    return next;
  }

  applyCustomVoiceSettings(settings: { active_source?: 'edge' | 'custom'; active_voice_id?: string; edge_voice?: string; rate?: string }): VoiceSettingsStore {
    return this.setActive(settings);
  }

  createOrUpdateCustomVoice(input: {
    name: string;
    edge_voice?: string;
    rate?: string;
    sample_base64?: string;
    sample_mime?: string;
  }): CustomVoiceProfile {
    const id = this.sanitizeId(input.name);
    if (!id) throw new Error('Invalid voice name');

    const now = this.now();
    const voices = this.readProfiles();
    const existing = voices.find((v) => v.id === id);

    let sampleFile = existing?.sample_file;
    if (input.sample_base64) {
      const mime = String(input.sample_mime || 'audio/mpeg').toLowerCase();
      const ext = mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'mp3';
      const safeB64 = String(input.sample_base64).replace(/^data:.*;base64,/, '');
      const buf = Buffer.from(safeB64, 'base64');
      if (buf.length === 0 || buf.length > 15 * 1024 * 1024) {
        throw new Error('Voice sample size invalid (max 15MB)');
      }
      const fileName = `${id}.${ext}`;
      fs.writeFileSync(path.join(this.samplesDir, fileName), buf);
      sampleFile = fileName;
    }

    const next: CustomVoiceProfile = {
      id,
      name: input.name.trim(),
      edge_voice: String(input.edge_voice || existing?.edge_voice || TTS_VOICE),
      rate: this.sanitizeRate(input.rate || existing?.rate || TTS_RATE),
      sample_file: sampleFile,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    const merged = existing
      ? voices.map((v) => (v.id === id ? next : v))
      : [...voices, next];

    this.writeProfiles(merged);
    return next;
  }
}
