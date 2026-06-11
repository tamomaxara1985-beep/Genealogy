import { Webhooks } from "@dodopayments/nextjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { getPlanFromProductId } from "@/lib/plans";

type SubscriptionData = {
  subscription_id?: string;
  product_id?: string;
  next_billing_date?: string;
  customer?: { customer_id: string; email?: string };
};

async function handleSubscriptionEvent(
  type: string,
  data: SubscriptionData
) {
  await connectDB();

  const subId = data.subscription_id;
  const customerId = data.customer?.customer_id;
  const email = data.customer?.email;

  switch (type) {
    case "subscription.active": {
      if (!subId || !customerId) return;
      const plan = getPlanFromProductId(data.product_id ?? "");
      const update = {
        plan,
        planStatus: "active",
        dodoCustomerId: customerId,
        dodoSubscriptionId: subId,
        planExpiresAt: data.next_billing_date
          ? new Date(data.next_billing_date)
          : null,
      };
      // Try subscription ID first (idempotency), then customer ID, then email
      const bySubId = await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        update
      );
      if (!bySubId) {
        const byCustomerId = await User.findOneAndUpdate(
          { dodoCustomerId: customerId },
          update
        );
        if (!byCustomerId && email) {
          await User.findOneAndUpdate({ email }, update);
        }
      }
      break;
    }

    case "subscription.renewed": {
      if (!subId) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        {
          planStatus: "active",
          planExpiresAt: data.next_billing_date
            ? new Date(data.next_billing_date)
            : null,
        }
      );
      break;
    }

    case "subscription.cancelled": {
      if (!subId) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        { planStatus: "cancelled" }
      );
      break;
    }

    case "subscription.on_hold": {
      if (!subId) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        { planStatus: "on_hold" }
      );
      break;
    }

    case "subscription.expired": {
      if (!subId) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        {
          plan: "free",
          planStatus: "active",
          dodoSubscriptionId: null,
          planExpiresAt: null,
        }
      );
      break;
    }

    case "subscription.plan_changed": {
      if (!subId || !data.product_id) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        { plan: getPlanFromProductId(data.product_id) }
      );
      break;
    }
  }
}

export const POST = Webhooks({
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
  onPayload: async (payload) => {
    const { type } = payload;
    if (!type.startsWith("subscription.")) return;
    await handleSubscriptionEvent(
      type,
      // @ts-ignore — WebhookPayload is a discriminated union; data shape varies per event type
      (payload.data ?? {}) as SubscriptionData
    );
  },
});
