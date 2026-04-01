"use client";

import Link from "next/link";
import { FadeIn, FloatingOrb } from "@/components/ui/motion";

export default function PrivacyPolicyPage() {
  const lastUpdated = "6 March 2026";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={400} color="teal" className="absolute -left-40 top-40" delay={0} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <FadeIn>
          <h1 className="font-display text-4xl font-bold text-white">Privacy Policy</h1>
          <p className="mt-2 text-sm text-zinc-500">Last updated: {lastUpdated}</p>
        </FadeIn>

        <div className="mt-10 space-y-10">
          <Section title="1. Who we are">
            <p>
              Shield HQ (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the Shield HQ platform — a marketplace connecting venues with SIA-licensed security professionals. 
              This privacy policy explains how we collect, use, store, and protect your personal information when you use our website, mobile app, and related services.
            </p>
            <p>
              If you have any questions about this policy, you can contact us at{" "}
              <a href="mailto:privacy@shieldsecurity.app" className="text-shield-400 hover:text-shield-300">privacy@shieldsecurity.app</a>.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>We collect the following types of information:</p>
            <h4 className="font-semibold text-white mt-4 mb-2">Account information</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Name, email address, and phone number</li>
              <li>Password (stored securely, hashed)</li>
              <li>Role (venue, security personnel)</li>
              <li>Profile photo (optional)</li>
            </ul>
            <h4 className="font-semibold text-white mt-4 mb-2">Verification information (security personnel)</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>SIA licence number and type</li>
              <li>SIA licence expiry date</li>
              <li>Uploaded identity and licence documents</li>
            </ul>
            <h4 className="font-semibold text-white mt-4 mb-2">Venue information</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Venue name, type, and address</li>
              <li>Business contact details</li>
            </ul>
            <h4 className="font-semibold text-white mt-4 mb-2">Usage data</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Booking and shift history</li>
              <li>Payment transaction records</li>
              <li>GPS location data (when checking in/out of shifts, with your permission)</li>
              <li>Device information and app usage analytics</li>
              <li>Ratings and reviews you give or receive</li>
            </ul>
          </Section>

          <Section title="3. How we use your information">
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Create and manage your account</li>
              <li>Verify SIA licences and identity for security personnel</li>
              <li>Match venues with available, qualified security staff</li>
              <li>Process bookings and payments securely</li>
              <li>Send shift notifications, booking confirmations, and reminders</li>
              <li>Enable GPS check-in/check-out for shift tracking</li>
              <li>Display ratings and reviews to maintain platform quality</li>
              <li>Improve our platform and develop new features</li>
              <li>Communicate important updates about the service</li>
              <li>Prevent fraud and ensure the safety of all users</li>
            </ul>
          </Section>

          <Section title="4. How we share your information">
            <p>We share your information only in these circumstances:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li><strong className="text-white">With other users:</strong> When you book a shift, we share relevant profile information between the venue and the security professional (e.g. name, rating, SIA licence status).</li>
              <li><strong className="text-white">Payment processors:</strong> We use Stripe to process payments. Stripe receives the financial data necessary to process transactions.</li>
              <li><strong className="text-white">Service providers:</strong> We use trusted third-party services for hosting (Vercel), database (Supabase), and analytics. These providers only access data needed to provide their services.</li>
              <li><strong className="text-white">Legal requirements:</strong> We may disclose information if required by law, regulation, or legal process.</li>
            </ul>
            <p className="mt-3">We <strong className="text-white">never sell</strong> your personal data to third parties for marketing or advertising purposes.</p>
          </Section>

          <Section title="5. Data storage and security">
            <p>
              Your data is stored securely using industry-standard encryption. We use Supabase for our database (hosted in the UK/EU) and implement row-level security 
              to ensure users can only access data they&apos;re authorised to see.
            </p>
            <p>
              Passwords are hashed and never stored in plain text. Payment information is handled entirely by Stripe and never touches our servers.
            </p>
          </Section>

          <Section title="6. Your rights">
            <p>Under UK data protection law (UK GDPR), you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-white">Access</strong> the personal data we hold about you</li>
              <li><strong className="text-white">Correct</strong> inaccurate or incomplete data</li>
              <li><strong className="text-white">Delete</strong> your account and personal data</li>
              <li><strong className="text-white">Export</strong> your data in a portable format</li>
              <li><strong className="text-white">Restrict</strong> how we process your data in certain circumstances</li>
              <li><strong className="text-white">Object</strong> to processing based on legitimate interests</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:privacy@shieldsecurity.app" className="text-shield-400 hover:text-shield-300">privacy@shieldsecurity.app</a>. 
              We&apos;ll respond within 30 days.
            </p>
          </Section>

          <Section title="7. Location data">
            <p>
              Our mobile app uses GPS data for shift check-in and check-out verification. This allows venues to confirm that security staff have arrived on-site. 
              Location data is only collected during active shifts and with your explicit permission. You can disable location services at any time in your device settings, 
              though this may prevent you from using the check-in feature.
            </p>
          </Section>

          <Section title="8. Cookies">
            <p>
              We use essential cookies to keep you signed in and maintain your session. We may also use analytics cookies to understand how people use our platform. 
              You can control cookie settings in your browser.
            </p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              We may update this privacy policy from time to time. When we make significant changes, we&apos;ll notify you via email or an in-app notification. 
              The &quot;last updated&quot; date at the top of this page reflects when this policy was last modified.
            </p>
          </Section>

          <Section title="10. Contact us">
            <p>
              If you have any questions or concerns about this privacy policy or how we handle your data, contact us at:
            </p>
            <div className="mt-3 glass rounded-xl p-4">
              <p><strong className="text-white">Shield HQ</strong></p>
              <p>Birmingham, United Kingdom</p>
              <p>Email: <a href="mailto:privacy@shieldsecurity.app" className="text-shield-400 hover:text-shield-300">privacy@shieldsecurity.app</a></p>
            </div>
          </Section>
        </div>

        <div className="mt-12 text-center text-sm text-zinc-500">
          <Link href="/terms" className="text-shield-400 hover:text-shield-300">Terms of Service</Link>
          {" · "}
          <Link href="/" className="text-shield-400 hover:text-shield-300">Back to home</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <FadeIn>
      <section>
        <h2 className="font-display text-xl font-semibold text-white mb-4">{title}</h2>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-3">{children}</div>
      </section>
    </FadeIn>
  );
}
