/**
 * NotificationSection — Settings 页"系统通知"区块。
 *
 * 桌面通知 — CC Agent session 完成 / 待回复时弹系统 toast(默认开)。
 * 外部通道 — 企业微信、Telegram 由用户单独选择开启，凭证仍在各自 IM
 * 机器人设置卡中配置，避免通知设置页接触任何敏感信息。
 */

import { useTranslation } from 'react-i18next';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useNotificationBridgeSettings } from '@/hooks/useNotificationBridgeSettings';

function NotificationToggleCard({
  label,
  hint,
  ariaLabel,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  ariaLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl p-5',
        'bg-[var(--settings-theme-card-bg)]',
        'border border-[var(--settings-theme-card-border)]',
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p
          className="text-13 font-medium text-[var(--settings-section-sublabel)]"
          style={{ letterSpacing: '0.12px' }}
        >
          {label}
        </p>
        <p className="text-12 leading-[1.4] text-[var(--settings-section-sublabel)] opacity-70">
          {hint}
        </p>
      </div>

      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={ariaLabel} />
    </div>
  );
}

export function NotificationSection() {
  const { enabled, setEnabled } = useNotificationSettings();
  const { wecomEnabled, telegramEnabled, setWecomEnabled, setTelegramEnabled } =
    useNotificationBridgeSettings();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-[14px]">
      <h2 className="text-16 font-medium leading-[1.2] text-[var(--settings-section-title)]">
        {t('settings.notifications.title')}
      </h2>

      <NotificationToggleCard
        label={t('settings.notifications.sessionDoneLabel')}
        hint={t('settings.notifications.sessionDoneHint')}
        ariaLabel={t('settings.notifications.sessionDoneAria')}
        checked={enabled}
        onCheckedChange={setEnabled}
      />

      <NotificationToggleCard
        label={t('settings.notifications.wecomSessionLabel')}
        hint={t('settings.notifications.wecomSessionHint')}
        ariaLabel={t('settings.notifications.wecomSessionAria')}
        checked={wecomEnabled}
        onCheckedChange={setWecomEnabled}
      />

      <NotificationToggleCard
        label={t('settings.notifications.telegramSessionLabel')}
        hint={t('settings.notifications.telegramSessionHint')}
        ariaLabel={t('settings.notifications.telegramSessionAria')}
        checked={telegramEnabled}
        onCheckedChange={setTelegramEnabled}
      />
    </div>
  );
}
