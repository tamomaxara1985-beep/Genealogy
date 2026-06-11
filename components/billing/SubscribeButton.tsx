"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  productId: string;
  email: string;
  label?: string;
  className?: string;
}

export function SubscribeButton({
  productId,
  email,
  label = "Subscribe",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/checkout?productId=${encodeURIComponent(productId)}&email=${encodeURIComponent(email)}`
      );
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} className={className}>
      {loading ? "Loading…" : label}
    </Button>
  );
}
