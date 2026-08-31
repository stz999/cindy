/**
 * Session notification channel preferences for the external Desktop bridge.
 *
 * Provider credentials remain in Main/IM-owned stores. This hook only stores
 * the user's opt-in channel switches in renderer localStorage, matching the
 * existing Feishu notification preference pattern.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEYS = {
  wecom: 'notifications.wecomEnabled',
  telegram: 'notifications.telegramEnabled',
} as const;

type Channel = keyof typeof STORAGE_KEYS;
const subscribers = new Set<() => void>();

function readEnabled(channel: Channel): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS[channel]) === 'true';
  } catch {
    return false;
  }
}

function notifySubscribers(): void {
  for (const subscriber of subscribers) subscriber();
}

export function getWecomNotificationsEnabled(): boolean {
  return readEnabled('wecom');
}

export function getTelegramNotificationsEnabled(): boolean {
  return readEnabled('telegram');
}

export function setExternalNotificationsEnabled(channel: Channel, enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS[channel], String(enabled));
  } catch {
    // localStorage 不可用时，当前进程仍通过 subscriber 更新 UI。
  }
  notifySubscribers();
}

export function useNotificationBridgeSettings(): {
  wecomEnabled: boolean;
  telegramEnabled: boolean;
  setWecomEnabled: (enabled: boolean) => void;
  setTelegramEnabled: (enabled: boolean) => void;
} {
  const [wecomEnabled, setWecomState] = useState(getWecomNotificationsEnabled);
  const [telegramEnabled, setTelegramState] = useState(getTelegramNotificationsEnabled);

  useEffect(() => {
    const update = () => {
      setWecomState(getWecomNotificationsEnabled());
      setTelegramState(getTelegramNotificationsEnabled());
    };
    subscribers.add(update);
    window.addEventListener('storage', update);
    return () => {
      subscribers.delete(update);
      window.removeEventListener('storage', update);
    };
  }, []);

  const setWecomEnabled = useCallback((enabled: boolean) => {
    setExternalNotificationsEnabled('wecom', enabled);
  }, []);
  const setTelegramEnabled = useCallback((enabled: boolean) => {
    setExternalNotificationsEnabled('telegram', enabled);
  }, []);

  return {
    wecomEnabled,
    telegramEnabled,
    setWecomEnabled,
    setTelegramEnabled,
  };
}
