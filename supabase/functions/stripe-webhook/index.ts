/**
 * stripe-webhook — receives Stripe's webhook for the Founding Marae
 * subscription Payment Link, verifies it is genuine, and on a real
 * successful signup creates a ClickUp task so Waj can start the manual
 * new-marae provisioning checklist (86d3tew2v) immediately.
 *
 * ClickUp 86d43y360, Stage 3. Deliberately does NOT attempt to automate
 * actual Supabase/Vercel provisioning -- 86d3tew2v is a manual checklist
 * by design (no CI/CD, no provisioning script exists yet), and building
 * that automation is a separate, much larger, explicitly-deferred task.
 * This function automates the notification, not the provisioning itself.
 *
 * Environment variables required:
 *   SUPABASE_URL              set automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY set automatically by Supabase
 *   STRIPE_WEBHOOK_SECRET     Stripe Dashboard -> Webhooks -> signing secret (whsec_...)
 *   STRIPE_SECRET_KEY         real Stripe API key (sk_...) -- not used by this
 *                             function's current scope, reserved for Stage 4/5
 *   CLICKUP_API_TOKEN         ClickUp personal API token
 *   ADMIN_ALERT_EMAIL         fallback recipient if the ClickUp call fails
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// npm: specifier deliberately used here instead of this repo's usual esm.sh
// imports -- Stripe's signature verification needs constructEventAsync with
// the SubtleCrypto provider to run correctly in a Deno edge runtime (no
// Node crypto module available), which is Stripe's own documented approach
// for Deno Deploy / Supabase Edge Functions.
import Stripe from 'npm:stripe@17';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const WEBHOOK_SECRET    = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const CLICKUP_TOKEN     = Deno.env.get('CLICKUP_API_TOKEN')!;
const ADMIN_ALERT_EMAIL = Deno.env.get('ADMIN_ALERT_EMAIL');
const NOTIFY_URL        = `${SUPABASE_URL}/functions/v1/send-notification`;

// MaraeHub list in ClickUp -- same list every other real task this project
// has used tonight lives in (86d3tew2v, 86d43y360, 86d42yxhx, etc).
const CLICKUP_LIST_ID = '901614875464';
const PROVISIONING_CHECKLIST_URL = 'https://app.clickup.com/t/86d3tew2v';

// apiVersion is inert for this function -- the only Stripe SDK call made
// here is constructEventAsync(), which verifies the webhook signature
// locally (HMAC over the raw body + webhook secret) and never hits
// Stripe's API. The webhook payload's shape is governed by the API
// version pinned to the webhook endpoint itself in the Dashboard, not by
// this client config. Revisit this value only if/when this function
// starts making live Stripe API calls (e.g. a future Stage 5 feature).
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  // Signature verification requires the exact raw bytes Stripe signed --
  // must read as text before any JSON parsing, or verification silently
  // fails against every genuine request.
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error('Missing stripe-signature header');
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${(err as Error).message}`);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
  }

  // Only checkout.session.completed is handled -- deliberately not
  // invoice.paid, which fires on every renewal and would re-notify "new
  // marae!" monthly for an already-provisioned one.
  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true, skipped: 'not checkout.session.completed' }), { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.mode !== 'subscription' || session.payment_status !== 'paid') {
    return new Response(JSON.stringify({ received: true, skipped: 'not a paid subscription checkout' }), { status: 200 });
  }

  // Early dedup check. Note: this check-then-insert-later has a narrow
  // theoretical race if Stripe ever delivered the exact same brand-new
  // event twice within milliseconds (both could pass this check before
  // either finishes) -- accepted as a low-probability edge case, same
  // risk tolerance as this codebase's existing ensureTask() dedup pattern.
  const { data: existing } = await db
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ received: true, skipped: 'already processed' }), { status: 200 });
  }

  const details = session.customer_details;

  // Business name resolution -- "businessname" is a guess at the real
  // Stripe Payment Link's custom_fields key, unconfirmed since the Payment
  // Link doesn't exist yet to check against a real payload. Three
  // fallbacks, most to least specific, none of which throw. Because a
  // wrong guess would otherwise fail silently forever, the raw
  // custom_fields are also surfaced below so the first real signup makes
  // the true key visible for a one-line fix.
  const customFields = session.custom_fields ?? [];
  const exactKeyField = customFields.find(f => f.key === 'businessname');
  // Heuristic: this Payment Link is only expected to carry one custom
  // field (business name) -- if the key guess misses but exactly one
  // field is present, it's almost certainly this one.
  const soleField = customFields.length === 1 ? customFields[0] : undefined;
  const businessNameField = exactKeyField ?? soleField;
  const businessName = businessNameField?.text?.value ?? details?.name ?? 'Unknown business';

  if (!exactKeyField && customFields.length > 0) {
    console.warn(
      `stripe-webhook: "businessname" key not found (got: ${customFields.map(f => f.key).join(', ')}). ` +
      `Used ${soleField ? 'the sole custom field as a heuristic' : 'the customer name fallback'}.`
    );
  }

  const rawCustomFieldsSummary = customFields.length > 0
    ? customFields.map(f => `${f.key} (${f.label?.custom ?? 'no label'}): ${f.text?.value ?? f.dropdown?.value ?? f.numeric?.value ?? 'empty'}`).join('; ')
    : 'none present on this session';

  const amount = session.amount_total != null ? (session.amount_total / 100).toFixed(2) : 'unknown';
  const address = details?.address
    ? [details.address.line1, details.address.line2, details.address.city, details.address.postal_code, details.address.country].filter(Boolean).join(', ')
    : 'Not provided';

  const eventDescription =
    `**Real, automatic signup — created by the Stripe webhook.**\n\n` +
    `A real payment succeeded for the Founding Marae offer. Start the provisioning checklist: ${PROVISIONING_CHECKLIST_URL}\n\n` +
    `**Customer details, from Stripe checkout:**\n` +
    `- Name: ${details?.name ?? 'Not provided'}\n` +
    `- Business name: ${businessName}\n` +
    `- Email: ${details?.email ?? 'Not provided'}\n` +
    `- Address: ${address}\n` +
    `- Amount: $${amount} ${(session.currency ?? '').toUpperCase()}\n` +
    `- Stripe customer ID: ${session.customer ?? 'Not set'}\n` +
    `- Stripe subscription ID: ${session.subscription ?? 'Not set'}\n` +
    `- Checkout completed: ${new Date().toISOString()}\n` +
    (exactKeyField ? '' : `\n_Raw Stripe custom fields (confirming the "businessname" key): ${rawCustomFieldsSummary}_\n`);

  const clickupRes = await fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`, {
    method: 'POST',
    headers: {
      Authorization: CLICKUP_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `💳 New Founding Marae signup — ${businessName}`,
      markdown_description: eventDescription,
      priority: 1, // urgent
    }),
  });

  let notifiedSuccessfully = clickupRes.ok;

  if (!clickupRes.ok) {
    const errText = await clickupRes.text();
    console.error(`ClickUp task creation failed (${clickupRes.status}): ${errText}`);

    if (ADMIN_ALERT_EMAIL) {
      const emailRes = await fetch(NOTIFY_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: [ADMIN_ALERT_EMAIL],
          subject: `URGENT — real payment received, ClickUp task creation failed`,
          body:
            `A real Founding Marae payment succeeded, but MaraeHub could not create the ` +
            `ClickUp provisioning task automatically (ClickUp responded ${clickupRes.status}: ${errText}).\n\n` +
            `Please start the provisioning checklist manually: ${PROVISIONING_CHECKLIST_URL}\n\n` +
            eventDescription,
        }),
      });
      notifiedSuccessfully = emailRes.ok;
      if (!emailRes.ok) {
        console.error(`Fallback admin email also failed: ${await emailRes.text()}`);
      }
    } else {
      console.error('ADMIN_ALERT_EMAIL not set -- no fallback available for this failed ClickUp call.');
    }
  }

  if (!notifiedSuccessfully) {
    // Deliberately not recording the dedup row -- Stripe will retry this
    // event on a non-2xx response, giving us another real chance once
    // ClickUp or the fallback email recovers.
    return new Response(JSON.stringify({ error: 'Failed to notify — will retry' }), { status: 500 });
  }

  await db.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type });

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
