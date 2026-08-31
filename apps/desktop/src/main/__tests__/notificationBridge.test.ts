import { describe, expect, it, vi } from 'vitest';

import {
  NotificationBridge,
  createGenericWebhookProvider,
  createTelegramNotificationProvider,
  createWecomNotificationProvider,
} from '../notificationBridge';

const event = {
  sessionId: 'session-1',
  title: 'Build release',
  kind: 'done' as const,
  text: 'Cindy · 任务「Build release」已完成',
};

describe('NotificationBridge', () => {
  it('dispatches only selected providers and isolates provider failures', async () => {
    const wecom = { publishMarkdown: vi.fn(async () => {}) };
    const telegram = {
      sendText: vi.fn(async () => ({ messageId: 'message-1' })),
      getOwnerUserId: vi.fn(() => '42'),
    };
    const onError = vi.fn();
    const failing = {
      send: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    const bridge = new NotificationBridge(
      {
        wecom: createWecomNotificationProvider(wecom),
        telegram: createTelegramNotificationProvider(telegram),
        webhook: failing,
      },
      onError,
    );

    await bridge.dispatch(event, { wecom: true, telegram: true, webhook: true });

    expect(wecom.publishMarkdown).toHaveBeenCalledWith(event.text);
    expect(telegram.sendText).toHaveBeenCalledWith('42', event.text);
    expect(onError).toHaveBeenCalledWith('webhook', expect.any(Error));
  });

  it('does not send Telegram when no owner is bound', async () => {
    const sendText = vi.fn(async () => ({ messageId: 'message-1' }));
    const provider = createTelegramNotificationProvider({
      sendText,
      getOwnerUserId: () => null,
    });

    await provider.send(event);

    expect(sendText).not.toHaveBeenCalled();
  });

  it('posts a bounded JSON event to a secure generic webhook', async () => {
    const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    const provider = createGenericWebhookProvider(
      { url: 'https://notify.example.test/hook' },
      fetcher,
    );

    await provider.send(event);

    expect(fetcher).toHaveBeenCalledWith(
      'https://notify.example.test/hook',
      expect.objectContaining({ method: 'POST', redirect: 'manual' }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ event });
  });

  it('rejects insecure generic webhook URLs', () => {
    expect(() => createGenericWebhookProvider({ url: 'http://notify.example.test/hook' })).toThrow(
      'NOTIFICATION_WEBHOOK_INVALID',
    );
  });
});
