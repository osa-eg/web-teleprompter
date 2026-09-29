import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import { useSettings, type RemoteSettings as Remote } from '@/stores/settings';
import { Field } from '@/ui/Field';
import { Section, Switch } from '@/ui/controls';
import styles from './RemoteSettings.module.css';

const IceServersSchema = z
  .array(
    z.object({
      urls: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
      username: z.string().optional(),
      credential: z.string().optional(),
    }),
  )
  .max(10);

/** A text field that saves on blur/Enter (so the remote is not restarted on every keystroke). */
function CommitField({
  label,
  value,
  onCommit,
  hint,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  hint?: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'url';
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          className={styles.input}
          dir="ltr"
          value={draft}
          placeholder={placeholder}
          inputMode={inputMode}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => draft !== value && onCommit(draft)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      )}
    </Field>
  );
}

export function RemoteSettings() {
  const t = useT();
  const remote = useSettings((s) => s.settings.remote);
  const patch = useSettings((s) => s.patch);
  const set = (value: Partial<Remote>) => patch('remote', value);

  const [ice, setIce] = useState(() => (remote.iceServers ? JSON.stringify(remote.iceServers, null, 2) : ''));
  const [iceError, setIceError] = useState(false);
  const commitIce = () => {
    if (!ice.trim()) {
      setIceError(false);
      return set({ iceServers: null });
    }
    try {
      const parsed = IceServersSchema.safeParse(JSON.parse(ice));
      setIceError(!parsed.success);
      if (parsed.success) set({ iceServers: parsed.data });
    } catch {
      setIceError(true);
    }
  };

  return (
    <>
      <Section title={t('remote.title')}>
        <Switch
          label={t('remote.allowSettings')}
          checked={remote.allowSettingChanges}
          onChange={(allowSettingChanges) => set({ allowSettingChanges })}
        />
        <Switch
          label={t('remote.mediaKeys')}
          hint={t('remote.mediaKeysHint')}
          checked={remote.mediaKeys}
          onChange={(mediaKeys) => set({ mediaKeys })}
        />
      </Section>

      <Section title={t('remote.linkBase')}>
        <CommitField
          label={t('remote.linkBase')}
          hint={t('remote.linkBaseHint')}
          value={remote.remoteBaseUrl}
          placeholder="https://…/web-teleprompter/"
          inputMode="url"
          onCommit={(remoteBaseUrl) => set({ remoteBaseUrl: remoteBaseUrl.trim().slice(0, 500) })}
        />
      </Section>

      <Section title={t('remote.server')}>
        <p className={styles.hint}>{t('remote.serverHint')}</p>
        <CommitField
          label={t('remote.host')}
          value={remote.peerHost}
          placeholder="0.peerjs.com"
          inputMode="url"
          onCommit={(peerHost) => set({ peerHost: peerHost.trim().slice(0, 253) })}
        />
        <div className={styles.row}>
          <CommitField
            label={t('remote.port')}
            value={remote.peerPort === null ? '' : String(remote.peerPort)}
            placeholder="443"
            inputMode="numeric"
            onCommit={(port) => {
              const n = Number(port);
              set({ peerPort: port.trim() && Number.isInteger(n) && n > 0 && n < 65_536 ? n : null });
            }}
          />
          <CommitField
            label={t('remote.path')}
            value={remote.peerPath}
            placeholder="/"
            onCommit={(peerPath) => set({ peerPath: peerPath.trim().slice(0, 200) || '/' })}
          />
        </div>
        <Switch label={t('remote.secure')} checked={remote.secure} onChange={(secure) => set({ secure })} />
        <Field label={t('remote.iceServers')} hint={iceError ? t('remote.iceInvalid') : t('remote.iceHint')}>
          {(id) => (
            <textarea
              id={id}
              className={styles.textarea}
              dir="ltr"
              rows={4}
              spellCheck={false}
              value={ice}
              aria-invalid={iceError || undefined}
              onChange={(e) => setIce(e.currentTarget.value)}
              onBlur={commitIce}
            />
          )}
        </Field>
      </Section>
    </>
  );
}
