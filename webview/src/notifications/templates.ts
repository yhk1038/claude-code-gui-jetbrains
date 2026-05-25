import { APP_NAME } from '@/config/app';
import {
  NotificationKind,
  type NotificationContext,
  type NotificationTemplate,
} from './types';

export const NOTIFICATION_TEMPLATES: Record<NotificationKind, NotificationTemplate> = {
  [NotificationKind.SESSION_COMPLETE]: {
    title: (ctx: NotificationContext) => ctx.sessionTitle ?? APP_NAME,
    body: 'Response complete',
    icon: '/favicon.svg',
  },
  [NotificationKind.STREAM_ERROR]: {
    title: (ctx: NotificationContext) => ctx.sessionTitle ?? APP_NAME,
    body: 'Response failed',
    icon: '/favicon.svg',
  },
  [NotificationKind.AWAITING_PERMISSION]: {
    title: (ctx: NotificationContext) => ctx.sessionTitle ?? APP_NAME,
    body: 'Permission requested',
    icon: '/favicon.svg',
  },
  [NotificationKind.AWAITING_PLAN_APPROVAL]: {
    title: (ctx: NotificationContext) => ctx.sessionTitle ?? APP_NAME,
    body: 'Plan ready for review',
    icon: '/favicon.svg',
  },
};
