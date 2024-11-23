"use client";

import { createClient } from "@/utils/supabase/client/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TestCalendarPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarData, setCalendarData] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check URL for error parameters
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    const errorDesc = urlParams.get("error_description");

    if (errorParam) {
      setError(`${errorParam}: ${errorDesc}`);
    }

    // Fetch current calendar connection status
    fetchCalendarStatus();
  }, []);

  const fetchCalendarStatus = async () => {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .limit(1)
      .single();
    if (!user) return;

    const { data, error } = await supabase
      .from("user_calendars")
      .select("*")
      .eq("user_id", user.id)
      .eq("calendar_type", "outlook")
      .single();

    if (data) {
      setCalendarData(data);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar/outlook/initiate", {
        redirect: "follow",
      });

      console.log("Response", response);
      if (!response.ok)
        throw new Error("Failed to initiate calendar connection");

      const authUrl = await response.text();
      console.log("Auth URL received:", authUrl);

      // Validate the URL before redirecting
      if (!authUrl.startsWith("http")) {
        throw new Error("Invalid authentication URL received");
      }
      window.location.assign(authUrl);
    } catch (err) {
      console.log("Error", err);
      setError(
        err instanceof Error ? err.message : "Failed to connect calendar"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestSilentRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar/outlook/silent");
      if (!response.ok) throw new Error("Failed to refresh token silently");

      await fetchCalendarStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Test Calendar Integration
          </h2>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {calendarData ? (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
                Calendar Connected!
                <br />
                Token expires:{" "}
                {new Date(calendarData.token_expiry).toLocaleString()}
              </div>

              <button
                onClick={handleTestSilentRefresh}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? "Testing..." : "Test Silent Refresh"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Connect Calendar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
