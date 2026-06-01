import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { authenticate, requireTenant } from '../lib/tenant.js';
import { controlPrisma } from '../lib/controlPrisma.js';
import { decryptSecret } from '../lib/crypto.js';
import { getTenantPrisma } from '../lib/tenantPrisma.js';

interface CreateOrderBody {
  itemType: 'course' | 'batch' | 'test';
  itemId: string;
  amountMinor: number;
  currency?: string;
  description?: string;
  provider?: 'razorpay' | 'stripe';
}

async function loadTenantCredential(
  tenantId: string,
  provider: 'razorpay' | 'stripe'
): Promise<{ publicKey: string; secretKey: string; webhookSecret: string | null; mode: string; currency: string } | null> {
  const cred = await controlPrisma.tenantPaymentCredential.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });
  if (!cred || !cred.isActive) return null;
  return {
    publicKey: cred.publicKey,
    secretKey: decryptSecret(cred.secretKeyEnc),
    webhookSecret: cred.webhookSecretEnc ? decryptSecret(cred.webhookSecretEnc) : null,
    mode: cred.mode,
    currency: cred.currency,
  };
}

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

async function createRazorpayOrder(
  cred: { publicKey: string; secretKey: string },
  amountMinor: number,
  currency: string,
  receipt: string
): Promise<RazorpayOrderResponse> {
  const auth = Buffer.from(`${cred.publicKey}:${cred.secretKey}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: amountMinor, currency, receipt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay order creation failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RazorpayOrderResponse;
}

interface StripeSessionResponse {
  id: string;
  url: string;
  amount_total: number;
  currency: string;
  status: string;
}

async function createStripeCheckoutSession(
  cred: { secretKey: string },
  amountMinor: number,
  currency: string,
  description: string,
  successUrl: string,
  cancelUrl: string
): Promise<StripeSessionResponse> {
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', currency.toLowerCase());
  params.append('line_items[0][price_data][unit_amount]', String(amountMinor));
  params.append('line_items[0][price_data][product_data][name]', description);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cred.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe session creation failed: ${res.status} ${text}`);
  }
  return (await res.json()) as StripeSessionResponse;
}

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}

function verifyRazorpayWebhook(rawBody: string, signature: string, webhookSecret: string): boolean {
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}

function verifyStripeWebhook(rawBody: string, signatureHeader: string, webhookSecret: string): boolean {
  // Minimal Stripe sig verification; for production-grade, prefer the official SDK.
  const elements = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k.trim(), v?.trim() ?? ''];
    })
  );
  const timestamp = elements.t;
  const v1 = elements.v1;
  if (!timestamp || !v1) return false;
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(v1, 'utf8'));
}

export async function paymentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List the current student's orders
  app.get('/orders/me', async (request, reply) => {
    requireTenant(request);
    const prisma = await request.getTenantPrisma();
    const user = request.user as { sub: string };
    const orders = await prisma.order.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: { payments: true },
    });
    return reply.send(orders);
  });

  // Create a checkout order
  app.post('/orders', async (request, reply) => {
    const tenantId = requireTenant(request);
    const prisma = await request.getTenantPrisma();
    const user = request.user as { sub: string };
    const body = request.body as CreateOrderBody;
    if (!body.itemType || !body.itemId || !body.amountMinor || body.amountMinor <= 0) {
      return reply.status(400).send({ error: 'itemType, itemId and positive amountMinor are required' });
    }

    const provider = body.provider ?? 'razorpay';
    const cred = await loadTenantCredential(tenantId, provider);
    if (!cred) {
      return reply.status(400).send({
        error: `${provider} is not configured for this tenant. Ask the super admin to add credentials.`,
      });
    }

    const currency = body.currency ?? cred.currency;
    const order = await prisma.order.create({
      data: {
        tenantId,
        userId: user.sub,
        itemType: body.itemType,
        itemId: body.itemId,
        description: body.description ?? null,
        amountMinor: body.amountMinor,
        currency,
        provider,
        status: 'created',
        metadata: { mode: cred.mode },
      },
    });

    try {
      if (provider === 'razorpay') {
        const rzpOrder = await createRazorpayOrder(cred, body.amountMinor, currency, order.id);
        const updated = await prisma.order.update({
          where: { id: order.id },
          data: { providerOrderId: rzpOrder.id, status: 'pending' },
        });
        return reply.status(201).send({
          orderId: updated.id,
          provider,
          providerOrderId: rzpOrder.id,
          publicKey: cred.publicKey,
          amountMinor: rzpOrder.amount,
          currency: rzpOrder.currency,
          mode: cred.mode,
        });
      } else {
        const origin = request.headers.origin ?? '';
        const session = await createStripeCheckoutSession(
          cred,
          body.amountMinor,
          currency,
          body.description ?? `${body.itemType}/${body.itemId}`,
          `${origin}/payments/success?orderId=${order.id}`,
          `${origin}/payments/cancel?orderId=${order.id}`
        );
        const updated = await prisma.order.update({
          where: { id: order.id },
          data: { providerOrderId: session.id, status: 'pending' },
        });
        return reply.status(201).send({
          orderId: updated.id,
          provider,
          providerOrderId: session.id,
          checkoutUrl: session.url,
          amountMinor: session.amount_total,
          currency: session.currency.toUpperCase(),
          mode: cred.mode,
        });
      }
    } catch (err) {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } });
      request.log.error({ err }, 'payment provider call failed');
      return reply.status(502).send({ error: err instanceof Error ? err.message : 'Provider error' });
    }
  });

  // Verify a Razorpay payment signature (called from the client after success).
  app.post('/verify/razorpay', async (request, reply) => {
    const tenantId = requireTenant(request);
    const prisma = await request.getTenantPrisma();
    const body = request.body as {
      orderId: string;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    };
    const order = await prisma.order.findFirst({
      where: { id: body.orderId, tenantId, providerOrderId: body.razorpay_order_id },
    });
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.status === 'paid') return reply.send({ status: 'paid' });

    const cred = await loadTenantCredential(tenantId, 'razorpay');
    if (!cred) return reply.status(500).send({ error: 'Razorpay not configured' });

    const ok = verifyRazorpaySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
      cred.secretKey
    );
    if (!ok) return reply.status(400).send({ error: 'Invalid payment signature' });

    await prisma.payment.create({
      data: {
        tenantId,
        orderId: order.id,
        provider: 'razorpay',
        providerPaymentId: body.razorpay_payment_id,
        amountMinor: order.amountMinor,
        currency: order.currency,
        status: 'captured',
        rawPayload: { source: 'verify', signature: body.razorpay_signature },
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'paid', paidAt: new Date() },
    });
    return reply.send({ status: 'paid', orderId: order.id });
  });
}

// Webhooks live on a separate plugin so they can opt out of the
// preHandler authentication used by paymentRoutes.
export async function paymentWebhookRoutes(app: FastifyInstance) {
  app.post<{ Params: { tenantId: string }; Body: unknown }>(
    '/razorpay/:tenantId',
    async (request: FastifyRequest<{ Params: { tenantId: string } }>, reply: FastifyReply) => {
      const tenantId = request.params.tenantId;
      const cred = await loadTenantCredential(tenantId, 'razorpay');
      if (!cred?.webhookSecret) {
        return reply.status(404).send({ error: 'Webhook not configured' });
      }
      const sig = request.headers['x-razorpay-signature'];
      const rawBody = JSON.stringify(request.body ?? {});
      if (typeof sig !== 'string' || !verifyRazorpayWebhook(rawBody, sig, cred.webhookSecret)) {
        return reply.status(400).send({ error: 'Invalid signature' });
      }
      const event = request.body as { event: string; payload: { payment?: { entity: { order_id: string; id: string; amount: number; status: string } } } };
      const eventId = `${event.event}:${event.payload?.payment?.entity?.id ?? ''}`;

      const prisma = await getTenantPrisma(tenantId);
      try {
        await prisma.paymentEvent.create({
          data: {
            tenantId,
            provider: 'razorpay',
            eventId,
            type: event.event,
            payload: event as object,
          },
        });
      } catch (err) {
        // Duplicate webhook (idempotent) — that's fine.
        if ((err as { code?: string }).code !== 'P2002') {
          request.log.error({ err }, 'failed to record webhook event');
        }
      }

      const payment = event.payload?.payment?.entity;
      if (event.event === 'payment.captured' && payment) {
        const order = await prisma.order.findFirst({ where: { tenantId, providerOrderId: payment.order_id } });
        if (order && order.status !== 'paid') {
          await prisma.payment.upsert({
            where: { provider_providerPaymentId: { provider: 'razorpay', providerPaymentId: payment.id } },
            update: { status: 'captured', rawPayload: payment as object },
            create: {
              tenantId,
              orderId: order.id,
              provider: 'razorpay',
              providerPaymentId: payment.id,
              amountMinor: payment.amount,
              currency: order.currency,
              status: 'captured',
              rawPayload: payment as object,
            },
          });
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'paid', paidAt: new Date() },
          });
        }
      }

      return reply.send({ ok: true });
    }
  );

  app.post<{ Params: { tenantId: string }; Body: unknown }>(
    '/stripe/:tenantId',
    async (request: FastifyRequest<{ Params: { tenantId: string } }>, reply: FastifyReply) => {
      const tenantId = request.params.tenantId;
      const cred = await loadTenantCredential(tenantId, 'stripe');
      if (!cred?.webhookSecret) {
        return reply.status(404).send({ error: 'Webhook not configured' });
      }
      const sig = request.headers['stripe-signature'];
      const rawBody = JSON.stringify(request.body ?? {});
      if (typeof sig !== 'string' || !verifyStripeWebhook(rawBody, sig, cred.webhookSecret)) {
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      const event = request.body as { id: string; type: string; data: { object: { id: string; amount_total?: number; currency?: string; status?: string; metadata?: { orderId?: string } } } };
      const prisma = await getTenantPrisma(tenantId);
      try {
        await prisma.paymentEvent.create({
          data: {
            tenantId,
            provider: 'stripe',
            eventId: event.id,
            type: event.type,
            payload: event as object,
          },
        });
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') {
          request.log.error({ err }, 'failed to record webhook event');
        }
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const order = await prisma.order.findFirst({
          where: { tenantId, providerOrderId: session.id },
        });
        if (order && order.status !== 'paid') {
          await prisma.payment.upsert({
            where: { provider_providerPaymentId: { provider: 'stripe', providerPaymentId: session.id } },
            update: { status: 'captured', rawPayload: session as object },
            create: {
              tenantId,
              orderId: order.id,
              provider: 'stripe',
              providerPaymentId: session.id,
              amountMinor: session.amount_total ?? order.amountMinor,
              currency: (session.currency ?? order.currency).toUpperCase(),
              status: 'captured',
              rawPayload: session as object,
            },
          });
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'paid', paidAt: new Date() },
          });
        }
      }

      return reply.send({ ok: true });
    }
  );
}
