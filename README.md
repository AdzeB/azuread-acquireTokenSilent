## Tech Stack

- Next.js
- Supabase
- Azure AD / MSAL
- TypeScript
- Tailwind CSS

## Prerequisites

- Node.js (v18+)
- Supabase CLI
- Azure AD Application credentials

## Environment Variables

Create a `.env` file with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Azure AD / MSAL Configuration
OUTLOOK_CLIENT_ID=your_client_id
OUTLOOK_CLIENT_SECRET=your_client_secret
```

## Database Setup

1. Install Supabase CLI if you haven't already:

```bash
npm install -g supabase-cli
```

2. Link your Supabase project:

For online project:

```bash
supabase link --project-ref your-project-ref
```

For local development:

```bash
supabase start
```

3. Run the migrations:

For online project:

```bash
supabase db push
```

For local development:

```bash
supabase db reset
```

The migration will create the following tables and types (referenced in migration file):

```sql:supabase/migrations/20241120051015_init.sql
startLine: 1
endLine: 43
```

This includes:

- Calendar type enum (`outlook`, `google`, `apple`)
- Outlook account composite type
- Users table
- User calendars table
- MSAL cache table

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Key Components

### MSAL Cache Plugin

The cache plugin implementation for storing MSAL tokens in Supabase:

```typescript:src/utils/calendar/microsoft/index.ts
startLine: 18
endLine: 52
```

### Silent Token Refresh

The silent token refresh implementation:

```typescript:src/app/api/calendar/[provider]/silent/route.ts
startLine: 84
endLine: 172
```

### Main Test Page

The main page with calendar connection and silent refresh testing:

```typescript:src/app/page.tsx
startLine: 7
endLine: 89
```

## Reproduction Steps

1. Visit the homepage at http://localhost:3000
2. Click "Connect Calendar" button
3. Complete the Microsoft OAuth flow
4. After successful connection, you'll be redirected back
5. The page will show "Calendar Connected!" with token expiry time
6. Click "Test Silent Refresh" to attempt refreshing the token silently
7. The error should appear in the browser console

## Expected Behavior

- The silent refresh should successfully retrieve a new access token using the cached refresh token

## Actual Behavior

- The silent refresh fails with the error message indicating no refresh token is found in the cache
- This occurs despite the initial OAuth flow completing successfully

## Troubleshooting

If you encounter issues:

1. Check the browser console for detailed error messages
2. Verify your Azure AD app has the correct permissions
3. Ensure the Supabase tables were created correctly
4. Verify the environment variables are set correctly
