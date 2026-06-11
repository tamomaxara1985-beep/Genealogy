import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  standard: "Standard",
  premium: "Premium",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  cancelled: "Cancelled",
  on_hold: "On Hold",
  expired: "Expired",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  expired: "bg-gray-100 text-gray-600",
};

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const user = await User.findById(session.user.id)
    .select("plan planStatus dodoCustomerId planExpiresAt")
    .lean();

  if (!user) redirect("/login");

  const plan = user.plan ?? "free";
  const planStatus = user.planStatus ?? "active";
  const customerId = user.dodoCustomerId ?? null;
  const nextBilling = user.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Plan</span>
            <span className="font-semibold">{PLAN_LABELS[plan] ?? plan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Status</span>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                STATUS_COLORS[planStatus] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {STATUS_LABELS[planStatus] ?? planStatus}
            </span>
          </div>
          {nextBilling && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Next billing</span>
              <span className="text-sm">{nextBilling}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {plan !== "free" && customerId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Manage Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Update your payment method, view invoices, or cancel your
              subscription.
            </p>
            <a
              href={`/api/customer-portal?customer_id=${customerId}`}
              className="inline-flex items-center px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Open customer portal →
            </a>
          </CardContent>
        </Card>
      )}

      {plan === "free" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Upgrade your plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 mb-4">
              You&apos;re on the free plan. Upgrade to Standard for unlimited
              people and AI features, or Premium for unlimited trees.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              View plans →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
