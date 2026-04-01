import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source");

  if (source === "mobile") {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Setup Complete</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #080a0f; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .wrap { padding: 40px 20px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #9ca3af; font-size: 16px; line-height: 1.5; }
    .btn { display: inline-block; margin-top: 24px; padding: 14px 32px; background: #00d4aa; color: #080a0f; border-radius: 12px; font-weight: 600; font-size: 16px; text-decoration: none; cursor: pointer; border: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Bank account connected</h1>
    <p>Your Stripe onboarding is complete.<br>Tap Done above to return to the app.</p>
    <button class="btn" onclick="tryClose()">Close</button>
  </div>
  <script>
    function tryClose() {
      try { window.close(); } catch(e) {}
      document.querySelector('.btn').textContent = 'You can close this page';
    }
    setTimeout(tryClose, 1500);
  </script>
</body>
</html>`,
      {
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  // Web redirect
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/d/personnel/payments?success=true`);
}
