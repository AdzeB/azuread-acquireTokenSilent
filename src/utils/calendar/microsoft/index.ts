import {
  AuthorizationUrlRequest,
  ConfidentialClientApplication,
  Configuration,
  ICachePlugin,
  IConfidentialClientApplication,
  LogLevel,
  PublicClientApplication,
  TokenCacheContext,
} from "@azure/msal-node";
import { getGraphClient } from "@/utils/calendar/microsoft/graphClient";

import { SupabaseClient } from "@supabase/supabase-js";

// const { ConfidentialClientApplication, PublicClientApplication, LogLevel } =
//   require("@azure/msal-node");

export class SupabaseCachePlugin implements ICachePlugin {
  private supabase: SupabaseClient;
  private userId: string;

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    // Load the cache from Supabase for the specific user

    console.log("beforeCacheAccess", cacheContext);
    const { data, error } = await this.supabase
      .from("msal_cache")
      .select("cache_data")
      .eq("user_id", this.userId)
      .single();

    if (data && !error) {
      cacheContext.tokenCache.deserialize(data.cache_data);
    }
  }

  async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    if (cacheContext.cacheHasChanged) {
      // Save the updated cache to Supabase for the specific user
      const serializedCache = cacheContext.tokenCache.serialize();
      await this.supabase.from("msal_cache").upsert({
        user_id: this.userId,
        cache_data: serializedCache,
      });
    }
  }
}

// Initialize the MSAL client with your authentication configuration
export const msalConfig = (
  supabase: SupabaseClient,
  userId: string,
): Configuration => {
  return {
    auth: {
      clientId: process.env.OUTLOOK_CLIENT_ID || "",
      clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
      // authority:
      //   `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID}`,
      authority: `https://login.microsoftonline.com/common`,
    },
    cache: {
      cachePlugin: new SupabaseCachePlugin(supabase, userId),
    },
    system: {
      loggerOptions: {
        loggerCallback(
          loglevel: LogLevel,
          message: string,
          containsPii: boolean,
        ) {
          console.log(message);
        },
        piiLoggingEnabled: false,
        logLevel: LogLevel.Info,
      },
    },
  };
};

// export const msalClient = new ConfidentialClientApplication(
//   msalConfig( "RANDOM_USER_ID"),
// );

export function getMsalClient(supabase: SupabaseClient, userId: string) {
  return new ConfidentialClientApplication(msalConfig(supabase, userId));
}

export const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "Calendars.Read",
  "Calendars.ReadWrite",
  "email",
  "user.read",
  "offline_access",
];

export const getRedirectUri = (provider: string) =>
  `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/${provider}/callback`;

interface NewEventParams {
  accessToken: string;
  title: string;
  participants: string[]; // Array of email addresses
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  applicationUrl: string; // e.g., your application's URL for callbacks or references
}

interface CreateEventResponse {
  "@odata.context": string;
  "@odata.etag": string;
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  changeKey: string;
  categories: string[];
  originalStartTimeZone: string;
  originalEndTimeZone: string;
  iCalUId: string;
  reminderMinutesBeforeStart: number;
  isReminderOn: boolean;
  hasAttachments: boolean;
  hideAttendees: boolean;
  subject: string;
  bodyPreview: string;
  importance: "normal" | "low" | "high";
  sensitivity: "normal" | "personal" | "private" | "confidential";
  isAllDay: boolean;
  isCancelled: boolean;
  isDraft: boolean;
  isOrganizer: boolean;
  responseRequested: boolean;
  seriesMasterId: string | null;
  transactionId: string;
  showAs:
    | "free"
    | "tentative"
    | "busy"
    | "oof"
    | "workingElsewhere"
    | "unknown";
  type: "singleInstance" | "occurrence" | "exception" | "seriesMaster";
  webLink: string;
  onlineMeetingUrl: string | null;
  isOnlineMeeting: boolean;
  onlineMeetingProvider:
    | "unknown"
    | "teamsForBusiness"
    | "skypeForBusiness"
    | "skypeForConsumer";
  onlineMeeting: null | object; // You might want to define a more specific type if needed
  allowNewTimeProposals: boolean;
  responseStatus: {
    response:
      | "none"
      | "organizer"
      | "tentativelyAccepted"
      | "accepted"
      | "declined"
      | "notResponded";
    time: string;
  };
  body: {
    contentType: "text" | "html";
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location: {
    displayName: string;
    locationType:
      | "default"
      | "conferenceRoom"
      | "homeAddress"
      | "businessAddress"
      | "geoCoordinates"
      | "streetAddress"
      | "hotel"
      | "restaurant"
      | "localBusiness"
      | "postalAddress";
    uniqueId: string;
    uniqueIdType:
      | "unknown"
      | "locationStore"
      | "directory"
      | "private"
      | "bing";
  };
  locations: Array<{
    displayName: string;
    locationType:
      | "default"
      | "conferenceRoom"
      | "homeAddress"
      | "businessAddress"
      | "geoCoordinates"
      | "streetAddress"
      | "hotel"
      | "restaurant"
      | "localBusiness"
      | "postalAddress";
    uniqueIdType:
      | "unknown"
      | "locationStore"
      | "directory"
      | "private"
      | "bing";
  }>;
  recurrence: null | object; // You might want to define a more specific type if needed
  attendees: Array<{
    type: "required" | "optional" | "resource";
    status: {
      response:
        | "none"
        | "organizer"
        | "tentativelyAccepted"
        | "accepted"
        | "declined"
        | "notResponded";
      time: string;
    };
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  organizer: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
}

export async function createOutlookCalendarEvent(
  params: NewEventParams,
): Promise<string | null> {
  const {
    accessToken,
    title,
    participants,
    startTime,
    endTime,
    applicationUrl,
  } = params;
  const client = getGraphClient(accessToken);

  // Prepare attendees
  const attendees = participants.map((email) => ({
    emailAddress: {
      address: email,
      name: email, // If you have the attendee's name, replace email with the name
    },
    type: "required", // or "optional"
  }));

  // Create event body
  const event = {
    subject: title,
    body: {
      contentType: "HTML",
      content: `Join the meeting <a href="${applicationUrl}">here</a>`,
    },
    start: {
      dateTime: startTime,
      timeZone: "UTC", // Adjust the time zone as needed
    },
    end: {
      dateTime: endTime,
      timeZone: "UTC",
    },
    attendees: attendees,
    location: {
      displayName: "Nabantu Campus",
    },
    allowNewTimeProposals: false,
    // Add other event properties as needed, such as location
  };

  try {
    const createdEvent = (await client
      .api("/me/events")
      .post(event)) as CreateEventResponse;

    if (!createdEvent) {
      return null;
    }

    return createdEvent.id;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    return null;
  }
}
