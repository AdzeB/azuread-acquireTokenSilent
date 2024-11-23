"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CalendarConnectedPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to test-calendar after 3 seconds
    const timeout = setTimeout(() => {
      router.push("/test-calendar");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Calendar Connected Successfully!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Redirecting you back to the calendar test page...
          </p>
          {/* Loading spinner */}
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
