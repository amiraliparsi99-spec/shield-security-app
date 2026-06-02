# Sign in with Apple + Google — setup checklist

This is the one-time configuration you (Ali) need to do in three external
dashboards. Code is already shipped; nothing happens until these are filled
in. Once done, fresh signups can use Apple/Google in ~2 taps.

The bundle ID is `app.shield.mobile` — use that everywhere a Bundle Identifier
is asked for.

---

## 1. Apple Developer (15 min)

### 1a. Enable "Sign in with Apple" capability

1. Go to <https://developer.apple.com/account/resources/identifiers/list>.
2. Find the App ID `app.shield.mobile`. (If it doesn't exist yet, create one
   with that exact bundle ID.)
3. Open it → **Capabilities** → tick **Sign in with Apple**. Save.

### 1b. Create a Services ID (used by Supabase)

1. Same page → **Identifiers** → top-right `+` → **Services IDs** → Continue.
2. Description: `Shield HQ Web Login`.
   Identifier: `app.shield.mobile.signin` (must be unique across Apple).
3. After creating, click into it and tick **Sign in with Apple** → Configure.
4. Primary App ID: `app.shield.mobile`.
5. Domains and Subdomains: `<your-supabase-project>.supabase.co`
   (e.g. `abcd1234.supabase.co`).
6. Return URLs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`.
7. Save → Continue → Save.

### 1c. Create a Sign in with Apple key (.p8 file)

1. <https://developer.apple.com/account/resources/authkeys/list> → `+`.
2. Key Name: `Shield HQ SIWA Key`. Tick **Sign in with Apple** → Configure →
   pick the App ID `app.shield.mobile` → Save → Continue → Register.
3. **Download the .p8 file now** (you only get one chance) and note the
   **Key ID** (10 characters).
4. Note your **Team ID** (top-right of the Apple Developer dashboard).

### 1d. Plug into Supabase

1. Supabase Dashboard → Authentication → Providers → **Apple** → Enable.
2. **Services ID**: `app.shield.mobile.signin` (from step 1b).
3. **Team ID**: from step 1c.
4. **Key ID**: from step 1c.
5. **Secret Key (.p8)**: paste the contents of the downloaded `.p8` file
   (everything between `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`).
6. Save.

✅ Apple is wired. The native iOS button will work after a rebuild
   (`npx expo run:ios`).

---

## 2. Google Cloud Console (15 min)

### 2a. Create the project (skip if you already have one)

1. <https://console.cloud.google.com> → top bar project switcher → **New Project**.
2. Name: `Shield HQ`. Create.

### 2b. Configure the OAuth consent screen

1. APIs & Services → **OAuth consent screen**.
2. User Type: **External** → Create.
3. App name: `Shield HQ`. User support email + developer email: yours.
   App domain: `shieldhq.co.uk`.
4. Scopes: leave defaults (email + profile is enough).
5. Test users: add your own Google account so you can test before publishing.
6. Save & continue all the way through.

### 2c. Create three OAuth Client IDs

In APIs & Services → **Credentials** → `+ Create Credentials` → OAuth client ID:

#### iOS Client (used by the iOS app)

- Application type: **iOS**.
- Name: `Shield HQ iOS`.
- Bundle ID: `app.shield.mobile`.
- Click Create. Copy the **Client ID**.
- Reverse it → `com.googleusercontent.apps.<CLIENT_ID_WITHOUT_.apps.googleusercontent.com>`.
  - Example: client ID `123456-abcdef.apps.googleusercontent.com` →
    reversed → `com.googleusercontent.apps.123456-abcdef`.

#### Web Client (used by Supabase)

- Application type: **Web application**.
- Name: `Shield HQ Web`.
- Authorized redirect URIs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`.
- Click Create. Copy the **Client ID** AND **Client Secret**.

### 2d. Plug into Supabase

1. Supabase → Authentication → Providers → **Google** → Enable.
2. **Client ID**: the *Web* client ID from step 2c.
3. **Client Secret**: the *Web* client secret from step 2c.
4. **Authorized Client IDs (for native apps)**: paste the *iOS* client ID
   (this lets Supabase accept ID tokens minted for the iOS app).
5. **Skip nonce checks**: leave OFF.
6. Save.

### 2e. Plug into the mobile app

In `mobile/.env`:

```env
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456-abcdef.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456-uvwxyz.apps.googleusercontent.com
```

In `mobile/app.json`, find the `@react-native-google-signin/google-signin`
plugin block and replace the placeholder with the *reversed iOS client ID*:

```json
[
  "@react-native-google-signin/google-signin",
  {
    "iosUrlScheme": "com.googleusercontent.apps.123456-abcdef"
  }
]
```

✅ Google is wired. Will work after the next `npx expo run:ios`.

---

## 3. Allow same-email account linking (Supabase)

By default, Supabase creates a **separate** user when someone signs in with
Google using an email that already has a password account. We want them
linked instead.

1. Supabase → Authentication → Sign In / Up → **User Signups**.
2. Toggle **Allow new users to sign up** ON (default).
3. Authentication → Sign In / Up → **Email** → enable
   **Confirm email** if it isn't already (this is what makes same-email
   linking safe — Supabase only links if the existing user's email is
   confirmed).
4. Authentication → URL Configuration → **Site URL**:
   `shieldhq://` (the mobile app's URL scheme).
   And add `shieldhq.co.uk` if you'll add OAuth on the web later.

> **Note**: as of 2025 Supabase Auth links accounts automatically when a new
> OAuth identity is added to a user with the same verified email. If a user
> hits a "Email already in use" error, double-check that their existing
> account's email is confirmed.

---

## 4. Rebuild the iOS app

OAuth requires native modules, so a rebuild is mandatory:

```bash
cd mobile
npx expo prebuild --clean        # regenerates ios/ folder with new entitlements
npx expo run:ios                 # builds & launches on the simulator
```

`prebuild --clean` will preserve our manual edits to `Info.plist` and
`Shield.entitlements` because they're driven by `app.json`.

---

## Smoke test (5 min)

After rebuilding:

1. Sign out (if currently signed in).
2. Open the app → tap **Sign up** or **Login**.
3. Tap **Continue with Apple** → confirm in the system sheet → you should
   land on `/signup/oauth-complete` with your name pre-filled.
4. Pick **Security pro**, type a city, allow notifications + location → tap
   **Finish**. You should land on the Explore tab.
5. Sign out, sign back in with the same Apple ID → you should skip
   straight past the role picker into the app (because the profile already
   exists).
6. Repeat steps 1-5 with Google.

If any step hangs, check the device console for `[oauth]` warnings.

## Common gotchas

- **"redirect_uri_mismatch"** from Google → the redirect URI in step 2c
  *Web Client* must be EXACTLY
  `https://<project>.supabase.co/auth/v1/callback`, no trailing slash.
- **"AppleSignIn is not available"** in the simulator → Apple sign-in only
  works on iOS 13+ devices/simulators that have an Apple ID configured. In
  Simulator: Settings → Sign in to your iPhone.
- **"Sign in with Apple is not enabled for this client"** → you forgot
  step 1a (enabling the capability on the App ID).
- **Google works in dev but Apple says "Cannot find Bundle ID"** → run
  `npx expo prebuild --clean` so the entitlements regenerate.
