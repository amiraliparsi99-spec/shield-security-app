# Running Shield on Mobile

Shield runs on mobile in two ways:

1. **PWA (Progressive Web App)** — install from the browser. Fast to ship, no app store.
2. **Expo (React Native)** — native iOS/Android app for the App Store and Google Play.

---

## 1. PWA — Install from your phone’s browser

The web app is already set up as a PWA. On a phone:

### Deploy the web app

- Deploy the Next.js app to **HTTPS** (e.g. Vercel).  
  **Important:** “Add to Home Screen” only works over HTTPS (or `localhost` for testing).

### On your phone

1. Open **Chrome** (Android) or **Safari** (iOS).
2. Go to your deployed URL (e.g. `https://shield.vercel.app`).
3. **Android (Chrome):**  
   - Menu (⋮) → **“Add to Home screen”** or **“Install app”**.
4. **iOS (Safari):**  
   - Share → **“Add to Home Screen”**.
5. The Shield icon appears on your home screen. Open it to use the app in a full-screen, app-like window.

### Local testing (same Wi‑Fi as your laptop)

1. Run the web app:  
   `npm run dev`
2. Find your computer’s IP (e.g. `192.168.1.10`).
3. On your phone’s browser, open:  
   `http://192.168.1.10:3000`  
   - On iOS, “Add to Home Screen” may not work over HTTP; use a tunnel (e.g. `npx ngrok http 3000`) for HTTPS.
4. Or run a **tunnel** and use the HTTPS URL on your phone:  
   `npx ngrok http 3000`  
   then open the `https://...ngrok.io` URL on the phone and add to home screen.

### PWA pieces in this repo

- **`src/app/manifest.ts`** — PWA manifest (name, icons, `standalone`, theme).
- **`src/app/layout.tsx`** — `viewport`, `themeColor`, `appleWebApp`.
- **`public/icon-192.png`**, **`public/icon-512.png`** — Placeholder icons.  
  **Replace with real 192×192 and 512×512 PNGs** for a proper home-screen icon.

---

## 2. Expo — Native iOS/Android app

The **`mobile/`** folder is an **Expo** app (React Native). It uses the same Supabase backend and the same flows; the UI is built with React Native for a native feel and app store distribution.

### One-time setup

```bash
cd mobile
npm install
```

Add a **`.env`** (or use EAS Secrets) with:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Run on a device or simulator

```bash
cd mobile
npx expo start
```

Then:

- **iOS Simulator:** press `i` in the terminal, or scan the QR code with the Camera app (only on a real device).
- **Android Emulator:** press `a`, or scan the QR code with the Expo Go app.
- **Physical device:** install **Expo Go** from the App Store or Play Store, then scan the QR code from `npx expo start`.

### What’s in `mobile/`

| Path | Role |
|------|------|
| `app/_layout.tsx` | Root layout, dark theme, `Stack` navigator |
| `app/index.tsx` | Home screen |
| `app/personnel/[id].tsx` | Personnel profile (reviews, location, experience) |
| `app.json` | App name, bundle IDs, icons, splash |
| `assets/` | Icons and splash. **Replace** `icon.png`, `splash-icon.png`, and `adaptive-icon.png` with proper 192×192 / 512×512 (or 1024×1024 for Android) before production builds. |

### Sharing logic with the web app

- **Supabase:** same `EXPO_PUBLIC_SUPABASE_*` / `NEXT_PUBLIC_SUPABASE_*` and the same Supabase project.
- **Types:** copy from `src/types/database.ts` into `mobile/types/` or a shared package when you add one.
- **API:** both web and mobile call the same Supabase (and any REST/GraphQL you add) so behaviour stays in sync.

### Publishing to the App Store / Play Store

1. Install EAS CLI:  
   `npm i -g eas-cli`  
   and log in:  
   `eas login`
2. Configure the project:  
   `eas build:configure`
3. Build:
   - iOS:  
     `eas build --platform ios --profile production`
   - Android:  
     `eas build --platform android --profile production`
4. Submit (or download the build and upload manually):
   - `eas submit --platform ios --profile production`
   - `eas submit --platform android --profile production`

Use [Expo Application Services (EAS)](https://docs.expo.dev/build/introduction/) for builds and OTA updates.

---

## Summary

| Goal | Use |
|------|-----|
| Quick mobile presence, no app store | **PWA** — deploy web app, “Add to Home Screen” |
| Native app, App Store / Play Store | **Expo** — `cd mobile && npx expo start`, then EAS Build |

Both use the same Supabase backend and the same data (personnel, reviews, locations, etc.).
