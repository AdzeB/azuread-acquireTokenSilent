import { NextRequest, NextResponse } from "next/server";
import { AuthorizationUrlRequest } from "@azure/msal-node";
import crypto from "crypto";
import { getMsalClient, getRedirectUri } from "@/utils/calendar/microsoft";
import { OUTLOOK_SCOPES } from "@/utils/calendar/microsoft/index";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "process";
import { Database } from "@/utils/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } },
) {
  const { provider } = params;
  const baseUrl = `${env.NEXT_PUBLIC_APP_URL}/en`;

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${baseUrl}/sync-calendar?error=user_not_found&error_description=could_not_find_user`,
    );
  }

  const authUrl = await getAuthUrl(supabase, user.id, provider);
  return NextResponse.redirect(authUrl);
}

async function getAuthUrl(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
): Promise<string> {
  const redirectUri = getRedirectUri(provider);

  switch (provider) {
    case "outlook":
      const authCodeUrlParameters: AuthorizationUrlRequest = {
        scopes: OUTLOOK_SCOPES,
        redirectUri: redirectUri,
        // prompt: "consent", // Force a new consent prompt
        // extraQueryParameters: {
        //   response_mode: "query", // Ensures compatibility with various OAuth flows
        // },
        responseMode: "query",
        prompt: "consent", // Force a new consent prompt
        extraQueryParameters: {
          response_mode: "query",
          access: "offline", // Explicitly request offline access
        },
      };

      // Generate the authorization URL
      const authUrl = await getMsalClient(supabase, userId).getAuthCodeUrl(
        authCodeUrlParameters,
      );
      return authUrl;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  return "Ok";
}
