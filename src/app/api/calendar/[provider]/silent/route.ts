import { NextRequest, NextResponse } from "next/server";
import {
  getMsalClient,
  getRedirectUri,
  OUTLOOK_SCOPES,
} from "@/utils/calendar/microsoft";
import { UTCDate } from "@date-fns/utc";
import { AccountInfo } from "@azure/msal-node";
import { TokenClaims } from "@azure/msal-common";
import { CalendarTokenData } from "../callback/route";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/utils/supabase/types";

// Helper function to return error response
const errorResponse = (message: string, status = 400) => {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } },
) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const requestUrl = new URL(request.url);

  const userData = await supabase.from("users").select("*").limit(1).single();

  const user = userData.data;

  if (!user) {
    return errorResponse("User not found", 404);
  }

  // Test AcquireToken Silent
  // Fetch the current user_calendars entry
  const { data: calendarData, error: calendarError } = await supabase
    .from("user_calendars")
    .select("*")
    .eq("user_id", user.id)
    .eq("calendar_type", "outlook")
    .single();

  if (calendarError || !calendarData) {
    return errorResponse("Calendar not found", 404);
  }

  console.log("Calendar Data:", calendarData);

  const msalTokenCache = getMsalClient(supabase, user.id).getTokenCache();

  console.log("Token Cache:", msalTokenCache);

  const account = await msalTokenCache.getAccountByHomeId(
    calendarData.outlook_details?.account_id ?? "",
  );

  console.log("Account:", account);

  if (!account) {
    return NextResponse.redirect(
      `${requestUrl.origin}?error=calendar-connection-failed&error_description=account-not-found`,
    );
  }

  // 3. Get MSAL cache data
  const { data: msalCacheData, error: msalCacheError } = await supabase
    .from("msal_cache")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (msalCacheError || !msalCacheData?.cache_data) {
    return errorResponse("MSAL cache not found", 404);
  }

  try {
    const response = await getMsalClient(supabase, user.id).acquireTokenSilent({
      account: JSON.parse(msalCacheData?.cache_data as string) as AccountInfo,
      scopes: calendarData.scopes ?? [],
      forceRefresh: true,
    });

    console.log("Response:", response);

    const tokenData: CalendarTokenData = {
      access_token: response.accessToken,
      calendar_type: "outlook",
      token_expiry: response.expiresOn
        ? new UTCDate(response.expiresOn).toISOString()
        : new UTCDate(Date.now() + 3600 * 1000).toISOString(),
      refresh_token: "",
      scopes: calendarData.scopes,
      outlook_details: {
        account_id: response.account?.homeAccountId ?? null,
        username: response.account?.username ?? null,
        name: response.account?.name ?? null,
        environment: response.account?.environment ?? null,
        tenant_id: response.account?.tenantId ?? null,
        local_account_id: response.account?.localAccountId ?? null,
        home_account_id: response.account?.homeAccountId ?? null,
        authority_type: response.account?.authorityType ?? null,
        tenant_profiles: [],
        id_token_claims:
          JSON.stringify(response.account?.idTokenClaims ?? "{}") ?? null,
        id_token: response.account?.idToken ?? null,
      },
      integration_email:
        (response.account?.idTokenClaims?.email as string | undefined) ??
          response.account?.username ??
          null,
    };

    const integrationEmail = "integration_email" in tokenData
      ? tokenData.integration_email
      : null;

    const outlookDetails = "outlook_details" in tokenData
      ? tokenData.outlook_details
      : null;

    const scopes = "scopes" in tokenData ? tokenData.scopes : null;

    // Update user_calendars table
    const { error: userInsertCalendarError } = await supabase
      .from("user_calendars")
      .upsert({
        user_id: user.id,
        calendar_type: calendarData.calendar_type,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expiry: tokenData.token_expiry,
        integration_email: integrationEmail ?? null,
        outlook_details: outlookDetails ?? null,
        scopes: scopes,
      });

    if (userInsertCalendarError) {
      console.error(
        "Error inserting user calendar silently:",
        userInsertCalendarError,
      );
      return errorResponse(
        userInsertCalendarError.message,
        500,
      );
    }

    console.log("User Calendar Inserted Successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Silent refresh error:", error);
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Failed to refresh token silently",
      400,
    );
  }
}
