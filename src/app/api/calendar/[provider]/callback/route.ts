//api/calendar/[provider]/callback
import { NextRequest, NextResponse } from "next/server";
import { Database } from "@/utils/supabase/types";
import {
  getMsalClient,
  getRedirectUri,
  OUTLOOK_SCOPES,
} from "@/utils/calendar/microsoft";
import { UTCDate } from "@date-fns/utc";
import { logger } from "@/utils/logger";
import { stringToBase64URL } from "@supabase/ssr";
import { env } from "process";
import { createClient } from "@supabase/supabase-js";

const providerToCalendarType: Record<
  string,
  Database["public"]["Enums"]["calendar_type"]
> = {
  microsoft: "outlook",
  google: "google",
  apple: "apple",
  outlook: "outlook",
};

type BaseTokenData = {
  access_token: string;
  calendar_type: Database["public"]["Enums"]["calendar_type"];
  token_expiry: string;
  refresh_token?: string | null;
  scopes: string[] | null;
};

type OutlookTokenData = BaseTokenData & {
  calendar_type: "outlook";
  outlook_details:
    | Database["public"]["CompositeTypes"]["outlook_account"]
    | null;
  integration_email: string | null;
};

export type CalendarTokenData = OutlookTokenData;

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } },
) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const baseUrl = `${process.env.NEXT_PUBLIC_APP_URL}`;
  const requestUrl = new URL(request.url);
  const { provider } = params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  const redirectUri = getRedirectUri(provider);

  if (error) {
    logger("Error in OAuth flow:", `${error}, ${error_description}`);
    return NextResponse.redirect(
      `${baseUrl}/sync-calendar?error=${error}&error_description=${error_description}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/sync-calendar?error=calendar-connection-failed&error_description=authorization-code-not-found`,
    );
  }

  let additionalData = {};

  const calendarType = providerToCalendarType[provider];
  if (!calendarType) {
    return NextResponse.redirect(
      `${baseUrl}/sync-calendar?error=calendar-connection-failed&error_description=unsupported-calendar-provider-${provider}`,
    );
  }

  let tokenData: CalendarTokenData | null = null;

  const userData = await supabase.from("users").select("*").limit(1).single();

  const user = userData.data;
  if (!user) {
    return NextResponse.redirect(
      `${baseUrl}/sync-calendar?error=calendar-connection-failed&error_description=user-not-found`,
    );
  }

  if (provider === "outlook") {
    try {
      const tokenRequest = {
        code: code,
        scopes: OUTLOOK_SCOPES,
        redirectUri: redirectUri,
        responseMode: "query",
        prompt: "consent", // Force a new consent prompt
        extraQueryParameters: {
          response_mode: "query",
          access: "offline", // Explicitly request offline access
        },
      };
      // Acquire an access token using the authorization code
      const response = await getMsalClient(
        supabase,
        user.id,
      ).acquireTokenByCode(tokenRequest);

      const token = response.accessToken;
      logger("Full token response:", JSON.stringify(response, null, 2));

      // Check for refresh token

      tokenData = {
        access_token: response.accessToken,
        calendar_type: "outlook",
        token_expiry: response.expiresOn
          ? new UTCDate(response.expiresOn).toISOString()
          : new UTCDate(Date.now() + 3600 * 1000).toISOString(),
        refresh_token: "",
        scopes: response.scopes,
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

      console.log("tokenData", JSON.stringify(tokenData, null, 2));
    } catch (error) {
      // Handle the token acquisition error
      logger("Error acquiring token for Outlook:", error);
      return NextResponse.redirect(
        `${baseUrl}/sync-calendar?error=calendar-connection-failed&error_description=failed-to-connect-to-calendar-provider`,
      );
    }
  } else {
    return NextResponse.redirect(
      `${baseUrl}/sync-calendar?error=calendar-connection-failed&error_description=unsupported-calendar-provider-${calendarType}`,
    );
  }

  if (!tokenData) {
    return NextResponse.redirect(
      `${baseUrl}/sync-calendar?error=calendar-connection-failed&error_description=token-data-not-found`,
    );
  }

  const integrationEmail = "integration_email" in tokenData
    ? tokenData.integration_email
    : null;

  const outlookDetails = "outlook_details" in tokenData
    ? tokenData.outlook_details
    : null;

  const scopes = "scopes" in tokenData ? tokenData.scopes : null;

  const { error: userInsertCalendarError } = await supabase
    .from("user_calendars")
    .upsert(
      {
        user_id: user.id,
        calendar_type: calendarType,
        access_token: tokenData?.access_token ?? "",
        refresh_token: tokenData?.refresh_token ?? "",
        token_expiry: tokenData?.token_expiry ?? "",
        integration_email: integrationEmail ?? null,
        outlook_details: outlookDetails ?? null,
        scopes: scopes ?? [],
        ...additionalData,
      },
      {
        onConflict: "user_id,calendar_type",
      },
    );

  if (userInsertCalendarError) {
    logger("Error inserting user calendar:", error);
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/en/sync-calendar?error=calendar-connection-failed&error_description=${userInsertCalendarError.message}`,
    );
  }

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({
      has_synced_calendar: true,
    })
    .eq("id", user.id);

  if (userUpdateError) {
    logger("Error updating auth user:", userUpdateError);
    return NextResponse.redirect(
      `${baseUrl}/sync-calendar?error=calendar-connection-failed&error_description=${userUpdateError?.message}`,
    );
  }

  // After successful calendar sync and before redirect
  const response = NextResponse.redirect(`${baseUrl}/calendar-connected`);

  return response;
}
