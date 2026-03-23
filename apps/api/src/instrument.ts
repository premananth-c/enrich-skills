import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: true,
  environment: process.env.NODE_ENV || 'production',
});
