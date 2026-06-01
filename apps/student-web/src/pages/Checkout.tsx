import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface OrderResponse {
  orderId: string;
  provider: 'razorpay' | 'stripe';
  providerOrderId: string;
  publicKey?: string;
  amountMinor: number;
  currency: string;
  mode: 'live' | 'test';
  checkoutUrl?: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

export default function Checkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const itemType = params.get('itemType') ?? '';
  const itemId = params.get('itemId') ?? '';
  const amountMinor = Number(params.get('amountMinor') ?? '0');
  const description = params.get('description') ?? '';
  const provider = (params.get('provider') ?? 'razorpay') as 'razorpay' | 'stripe';

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function startCheckout() {
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('enrich_student_token');
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
      const res = await fetch(`${apiBase}/api/v1/payments/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ itemType, itemId, amountMinor, description, provider }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const order = (await res.json()) as OrderResponse;

      if (order.provider === 'stripe') {
        if (!order.checkoutUrl) throw new Error('Stripe checkout URL missing');
        window.location.href = order.checkoutUrl;
        return;
      }

      await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      const rzp = new window.Razorpay({
        key: order.publicKey,
        order_id: order.providerOrderId,
        amount: order.amountMinor,
        currency: order.currency,
        name: description || 'Payment',
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verify = await fetch(`${apiBase}/api/v1/payments/verify/razorpay`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                orderId: order.orderId,
                ...response,
              }),
            });
            if (!verify.ok) {
              const data = (await verify.json().catch(() => ({}))) as { error?: string };
              throw new Error(data.error ?? 'Verification failed');
            }
            setDone(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed');
          }
        },
        modal: { ondismiss: () => setSubmitting(false) },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!itemType || !itemId || amountMinor <= 0) {
      setError('Missing checkout parameters');
    }
  }, [itemType, itemId, amountMinor]);

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: 32, textAlign: 'center' }}>
        <h2>Payment successful</h2>
        <p style={{ color: '#6b7280' }}>You can now access your purchase.</p>
        <button
          onClick={() => navigate(itemType === 'course' ? `/courses/${itemId}` : '/')}
          style={{ marginTop: 16 }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '64px auto', padding: 32 }}>
      <h2>Checkout</h2>
      <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <div><strong>Item:</strong> {description || `${itemType}/${itemId}`}</div>
        <div>
          <strong>Amount:</strong>{' '}
          {(amountMinor / 100).toLocaleString(undefined, { style: 'currency', currency: 'INR' })}
        </div>
        <div><strong>Provider:</strong> {provider}</div>
      </div>
      {error && <div style={{ color: '#dc2626', marginBottom: 12 }}>{error}</div>}
      <button onClick={startCheckout} disabled={submitting || amountMinor <= 0}>
        {submitting ? 'Starting checkout…' : 'Pay now'}
      </button>
    </div>
  );
}
