'use client';

import { useEffect, useState } from 'react';
import { Smartphone, KeyRound, Volume2, MonitorPlay, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { PageTitle } from '@/components/tv/page-title';
import { Focusable, FocusSection } from '@/components/tv/focusable';
import { RdKeyEntry } from '@/components/tv/rd-key-entry';
import { PairingOverlay } from '@/components/tv/pairing-overlay';
import { getRdKey, maskKey, subscribeRdKey } from '@/lib/rdkey';

type Audio = 'dub' | 'sub';
type Quality = 'auto' | '1080p' | '720p';

// TV-side preferences persist locally; account/RD-key sync happens through the
// device-code pairing flow (wired to the shared backend in a later pass).
function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(fallback);
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (stored) setVal(stored as T);
  }, [key]);
  const set = (v: T) => {
    setVal(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [val, set];
}

export default function SettingsPage() {
  const [audio, setAudio] = usePref<Audio>('tsumi.tv.audio', 'dub');
  const [quality, setQuality] = usePref<Quality>('tsumi.tv.quality', 'auto');
  const [overlay, setOverlay] = useState<'rd' | 'pair' | null>(null);
  const [rdKey, setRdKeyState] = useState('');

  useEffect(() => {
    setRdKeyState(getRdKey());
    return subscribeRdKey(() => setRdKeyState(getRdKey()));
  }, []);

  return (
    <div className="max-w-[52rem] pb-16">
      <PageTitle title="Settings" jp="設定" />

      {overlay === 'rd' && <RdKeyEntry onClose={() => setOverlay(null)} />}
      {overlay === 'pair' && <PairingOverlay onClose={() => setOverlay(null)} />}

      <FocusSection className="space-y-8 px-[var(--tv-safe)]">
        {/* Account / pairing */}
        <Section icon={<Smartphone className="h-5 w-5" />} title="Account" desc="Pair this TV with your phone to send your Real-Debrid key and list without typing on the remote.">
          <Row autoFocus onEnterPress={() => setOverlay('pair')}>
            {(f) => <RowBody focused={f} label="Pair with phone" value="Set up →" />}
          </Row>
        </Section>

        {/* Real-Debrid key */}
        <Section icon={<KeyRound className="h-5 w-5" />} title="Real-Debrid" desc="Optional. With a key, cached sources stream instantly. Without one, the app streams peer-to-peer.">
          <Row onEnterPress={() => setOverlay('rd')}>
            {(f) => <RowBody focused={f} label="Real-Debrid key" value={rdKey ? maskKey(rdKey) : 'Not set'} />}
          </Row>
        </Section>

        {/* Default audio */}
        <Section icon={<Volume2 className="h-5 w-5" />} title="Default audio" desc="English dub or original with subtitles.">
          <Segmented
            options={[
              { key: 'dub', label: 'Dub' },
              { key: 'sub', label: 'Sub' },
            ]}
            value={audio}
            onSelect={(v) => setAudio(v as Audio)}
          />
        </Section>

        {/* Quality */}
        <Section icon={<MonitorPlay className="h-5 w-5" />} title="Preferred quality" desc="Auto picks the smoothest source for your connection.">
          <Segmented
            options={[
              { key: 'auto', label: 'Auto' },
              { key: '1080p', label: '1080p' },
              { key: '720p', label: '720p' },
            ]}
            value={quality}
            onSelect={(v) => setQuality(v as Quality)}
          />
        </Section>
      </FocusSection>
    </div>
  );
}

function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/8 pt-6 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2.5 text-accent">
        {icon}
        <h2 className="text-[1.05rem] font-medium text-white">{title}</h2>
      </div>
      <p className="mb-4 max-w-[36rem] text-[0.78rem] text-zinc-400">{desc}</p>
      {children}
    </div>
  );
}

function Row({ onEnterPress, children, autoFocus }: { onEnterPress: () => void; children: (focused: boolean) => React.ReactNode; autoFocus?: boolean }) {
  return (
    <Focusable onEnterPress={onEnterPress} autoFocus={autoFocus} className="block">
      {children}
    </Focusable>
  );
}

function RowBody({ focused, label, value }: { focused: boolean; label: string; value: string }) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between rounded-xl px-5 py-4 transition-colors',
        focused ? 'bg-white/15' : 'bg-white/6',
      )}
    >
      <span className="text-[0.9rem] text-white">{label}</span>
      <span className="text-[0.8rem] text-zinc-400">{value}</span>
    </div>
  );
}

function Segmented({
  options,
  value,
  onSelect,
}: {
  options: { key: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <FocusSection className="flex gap-2.5">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Focusable key={o.key} ariaLabel={o.label} onEnterPress={() => onSelect(o.key)}>
            {(focused) => (
              <div
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-6 py-3 text-[0.85rem] font-medium transition-colors',
                  active ? 'bg-primary text-white' : focused ? 'bg-white/20 text-white' : 'bg-white/8 text-zinc-300',
                )}
              >
                {active && <Check className="h-4 w-4" />}
                {o.label}
              </div>
            )}
          </Focusable>
        );
      })}
    </FocusSection>
  );
}
