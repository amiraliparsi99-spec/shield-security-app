# How to run Shield

The project folder is **`security app`** (with a space). In the terminal, you must use quotes when you `cd` into it.

---

## 1. Web app (Next.js)

Open Terminal and run **each line separately**:

```bash
cd "/Users/aliparsi99/security app"
```

```bash
npm install
```

(wait for it to finish; needs internet)

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## 2. Mobile app (Expo)

```bash
cd "/Users/aliparsi99/security app/mobile"
```

```bash
npm install
```

```bash
npx expo start
```

Then scan the QR code with Expo Go on your phone, or press `i` for iOS simulator / `a` for Android.

---

## If it still won’t run

- **"command not found: npm"**  
  Install Node: https://nodejs.org (LTS). Then close and reopen Terminal.

- **"cd: no such file" or wrong folder**  
  Use the full path in quotes:  
  `cd "/Users/aliparsi99/security app"`  
  Or: in Finder, go to the project folder, drag it into the Terminal window, and press Enter (that will paste the path for you).

- **npm install is slow or fails**  
  Check your internet. If you’re behind a proxy or VPN, it may need to be adjusted.

- **Expo: "expo-asset cannot be found"**  
  In the `mobile` folder run:  
  `npm install`
