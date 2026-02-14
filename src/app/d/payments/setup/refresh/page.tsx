"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentSetupRefresh() {
  const router = useRouter();

  useEffect(() => {
    // Redirect back to payments to restart onboarding
    router.push("/d/payments");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500 mx-auto mb-4" />
        <p className="text-zinc-400">Redirecting...</p>
      </div>
    </div>
  );
}
