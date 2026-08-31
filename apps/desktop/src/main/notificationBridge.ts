/**
 * Desktop-side external notification bridge.
 *
 * This module adapts already-configured main-process providers to the common
 * session-event notification path and isolates provider failures.
 */
import type { TelegramIM } from '@cindy/im';

import type { WecomGroupNotificationPublisher } from './wecomGroupNotification';

export type NotificationBridgeChannel = 'wecom' | 'telegram' | 'webhook';

export interface NotificationBridgeEvent {
  sessionId: string;
  title: string;
  kind: 'done' | 'error' | 'needs-reply';
  text: string;
}

export interface NotificationBridgeProvider {
  send(event: NotificationBridgeEvent): Promise<void>;
}

export type NotificationBridgeProviders = Partial<
  Record<NotificationBridgeChannel, NotificationBridgeProvider>
>;

export interface GenericWebhookConfig {
  url: string;
  headers?: Readonly<Record<string, string>>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const MAX_WEBHOOK_RESPONSE_BYTES = 16 * 1024;
const MAX_WEBHOOK_BODY_BYTES = 16 * 1024;

function validateWebhookUrl(raw: string): string {
  const value = raw.trim();
  if (!value || value.length > 2_048) throw new Error('NOTIFICATION_WEBHOOK_INVALID');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('NOTIFICATION_WEBHOOK_INVALID');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('NOTIFICATION_WEBHOOK_INVALID');
  }
  return url.toString();
}

async function readBoundedResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_WEBHOOK_RESPONSE_BYTES) {
        throw new Error('NOTIFICATION_WEBHOOK_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

export class NotificationBridge {
  constructor(
    private readonly providers: NotificationBridgeProviders,
    private readonly onProviderError: (
      channel: NotificationBridgeChannel,
      error: unknown,
    ) => void = () => {},
  ) {}

  async dispatch(
    event: NotificationBridgeEvent,
    channels: Partial<Record<NotificationBridgeChannel, boolean>>,
  ): Promise<void> {
    const selected = (
      Object.entries(channels) as Array<[NotificationBridgeChannel, boolean | undefined]>
    )
      .filter(([channel, enabled]) => enabled === true && this.providers[channel])
      .map(([channel]) => [channel, this.providers[channel]!] as const);

    await Promise.all(
      selected.map(async ([channel, provider]) => {
        try {
          await provider.send(event);
        } catch (error) {
          this.onProviderError(channel, error);
        }
      }),
    );
  }
}

export function createWecomNotificationProvider(
  publisher: WecomGroupNotificationPublisher,
): NotificationBridgeProvider {
  return { send: (event) => publisher.publishMarkdown(event.text) };
}

export function createTelegramNotificationProvider(
  telegram: Pick<TelegramIM, 'getOwnerUserId' | 'sendText'>,
): NotificationBridgeProvider {
  return {
    async send(event) {
      const ownerUserId = telegram.getOwnerUserId();
      if (!ownerUserId) return;
      await telegram.sendText(ownerUserId, event.text);
    },
  };
}

export function createGenericWebhookProvider(
  config: GenericWebhookConfig,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): NotificationBridgeProvider {
  const url = validateWebhookUrl(config.url);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    ...config.headers,
  };

  return {
    async send(event) {
      const body = JSON.stringify({ event });
      if (Buffer.byteLength(body, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
        throw new Error('NOTIFICATION_WEBHOOK_BODY_TOO_LARGE');
      }
      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status >= 300 && response.status < 400) {
        throw new Error('NOTIFICATION_WEBHOOK_REDIRECT_REJECTED');
      }
      const responseText = await readBoundedResponse(response);
      if (!response.ok) {
        throw new Error(
          'NOTIFICATION_WEBHOOK_FAILED:' + response.status + ':' + responseText.slice(0, 200),
        );
      }
    },
  };
}

export const __testing = { validateWebhookUrl, readBoundedResponse };
