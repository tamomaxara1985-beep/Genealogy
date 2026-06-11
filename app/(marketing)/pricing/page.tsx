import { auth } from "@/lib/auth";
import { SubscribeButton } from "@/components/billing/SubscribeButton";
import { Check } from "lucide-react";

const FREE_FEATURES = [
  "1 family tree",
  "Up to 30 people per tree",
  "Relationship mapping",
  "Family tree canvas",
];

const STANDARD_FEATURES = [
  "1 family tree",
  "Unlimited people per tree",
  "Relationship mapping",
  "Family tree canvas",
  "AI research assistant",
];

const PREMIUM_FEATURES = [
  "Unlimited family trees",
  "Unlimited people per tree",
  "Relationship mapping",
  "Family tree canvas",
  "AI research assistant",
];

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-gray-600">
      <Check size={16} className="text-amber-500 shrink-0" />
      {text}
    </li>
  );
}

export default async function PricingPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const currentPlan = session?.user?.plan ?? null;

  return (
    <div className="bg-gray-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-3">Choose your plan</h1>
        <p className="text-center text-gray-500 mb-12">
          Start free. Upgrade when you&apos;re ready.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Free</h2>
              <div className="text-3xl font-bold mt-1">$0</div>
              <p className="text-sm text-gray-500 mt-1">Forever free</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {FREE_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
            {currentPlan === "free" || !currentPlan ? (
              <div className="w-full text-center py-2 text-sm font-medium text-gray-400 border border-gray-200 rounded-lg">
                Current plan
              </div>
            ) : (
              <a
                href="/register"
                className="w-full text-center py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Get started
              </a>
            )}
          </div>

          {/* Standard */}
          <div className="bg-white rounded-2xl border-2 border-amber-400 p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Most popular
            </div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Standard</h2>
              <div className="text-3xl font-bold mt-1">TBD</div>
              <p className="text-sm text-gray-500 mt-1">per month</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {STANDARD_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
            {currentPlan === "standard" ? (
              <div className="w-full text-center py-2 text-sm font-medium text-gray-400 border border-gray-200 rounded-lg">
                Current plan
              </div>
            ) : email ? (
              <SubscribeButton
                productId="pdt_0Ngp959eAaBGtnmvgciKO"
                email={email}
                label="Subscribe"
                className="w-full"
              />
            ) : (
              <a
                href="/register"
                className="w-full text-center py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                Get started
              </a>
            )}
          </div>

          {/* Premium */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Premium</h2>
              <div className="text-3xl font-bold mt-1">TBD</div>
              <p className="text-sm text-gray-500 mt-1">per month</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {PREMIUM_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
            <div className="w-full text-center py-2 text-sm font-medium text-gray-400 border border-gray-200 rounded-lg">
              Coming soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
