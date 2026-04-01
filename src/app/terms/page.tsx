"use client";

import Link from "next/link";
import { FadeIn, FloatingOrb } from "@/components/ui/motion";

export default function TermsOfServicePage() {
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
          <h1 className="font-display text-4xl font-bold text-white">Terms of Service</h1>
          <p className="mt-2 text-sm text-zinc-500">Last updated: {lastUpdated}</p>
        </FadeIn>

        <div className="mt-10 space-y-10">
          <Section title="1. Introduction">
            <p>
              Welcome to Shield HQ. These Terms of Service (&quot;Terms&quot;) govern your use of the Shield HQ platform, including our website, mobile applications, 
              and related services (collectively, the &quot;Service&quot;). By creating an account or using Shield HQ, you agree to these Terms.
            </p>
            <p>
              Shield HQ is operated by Shield HQ (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), based in Birmingham, United Kingdom. 
              If you do not agree to these Terms, please do not use our Service.
            </p>
          </Section>

          <Section title="2. The Service">
            <p>
              Shield HQ is a marketplace platform that connects venues (such as bars, clubs, event spaces, and other businesses) with SIA-licensed security professionals. 
              We facilitate the discovery, booking, and payment process between these parties.
            </p>
            <p>
              <strong className="text-white">Shield HQ is not a security agency.</strong> We do not employ security personnel. 
              We provide the technology platform that enables venues and security professionals to connect directly. 
              The contractual relationship for any shift is between the venue and the security professional.
            </p>
          </Section>

          <Section title="3. Accounts and registration">
            <p>To use Shield HQ, you must:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Be at least 18 years old</li>
              <li>Provide accurate and complete registration information</li>
              <li>Keep your account credentials secure</li>
              <li>Notify us immediately of any unauthorised access to your account</li>
            </ul>
            <p className="mt-3">
              You are responsible for all activity under your account. We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </Section>

          <Section title="4. Security personnel obligations">
            <p>If you register as a security professional, you agree to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Hold a valid SIA licence for the type of work you accept</li>
              <li>Provide accurate licence information and keep it up to date</li>
              <li>Notify Shield HQ immediately if your SIA licence is revoked, suspended, or expires</li>
              <li>Attend all accepted shifts on time and carry out duties professionally</li>
              <li>Use the GPS check-in/check-out feature when working shifts booked through Shield HQ</li>
              <li>Maintain appropriate conduct at all times while representing yourself on the platform</li>
            </ul>
            <p className="mt-3">
              Working in security without a valid SIA licence is a criminal offence. Shield HQ verifies licences during signup but it remains your legal responsibility to ensure your licence is valid at all times.
            </p>
          </Section>

          <Section title="5. Venue obligations">
            <p>If you register as a venue, you agree to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide accurate venue and business information</li>
              <li>Post shift requests honestly, including accurate descriptions and requirements</li>
              <li>Pay the agreed rate for completed shifts</li>
              <li>Provide a safe working environment for security staff</li>
              <li>Rate and review security professionals fairly and honestly</li>
              <li>Not attempt to circumvent the platform to hire Shield HQ users directly</li>
            </ul>
          </Section>

          <Section title="6. Bookings and cancellations">
            <p>
              When a venue sends a shift offer and a security professional accepts, it becomes a confirmed booking. Both parties are expected to honour confirmed bookings.
            </p>
            <h4 className="font-semibold text-white mt-4 mb-2">Cancellations by security personnel</h4>
            <p>
              If you need to cancel an accepted shift, do so as early as possible through the app. Repeated last-minute cancellations or no-shows will negatively 
              impact your reliability rating and may result in account restrictions.
            </p>
            <h4 className="font-semibold text-white mt-4 mb-2">Cancellations by venues</h4>
            <p>
              Venues may cancel a booking through the platform. If a shift is cancelled with less than 24 hours&apos; notice, the venue may be required to pay a cancellation fee 
              to compensate the security professional for lost work.
            </p>
          </Section>

          <Section title="7. Fees and payments">
            <h4 className="font-semibold text-white mb-2">For venues</h4>
            <p>
              Using Shield HQ is <strong className="text-white">free for venues</strong>. There are no sign-up fees, subscription fees, or per-booking charges. 
              You pay only the agreed hourly rate for the security professional.
            </p>
            <h4 className="font-semibold text-white mt-4 mb-2">For security personnel</h4>
            <p>
              Shield HQ charges a <strong className="text-white">10% platform fee</strong> deducted from your earnings for each completed shift. 
              For example, if a venue pays £18/hr, you receive £16.20/hr. This fee covers the platform, matching, verification, payment processing, and support services.
            </p>
            <h4 className="font-semibold text-white mt-4 mb-2">Payment processing</h4>
            <p>
              All payments are processed securely through Stripe. By using Shield HQ, you agree to Stripe&apos;s terms of service for payment processing. 
              Shield HQ does not store your full payment card details.
            </p>
          </Section>

          <Section title="8. Ratings and reviews">
            <p>
              After each completed shift, both parties may rate and review each other. Reviews must be honest, fair, and based on genuine experience. We do not tolerate:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Fake or misleading reviews</li>
              <li>Reviews that contain threats, harassment, or discrimination</li>
              <li>Attempts to manipulate ratings through coordinated or incentivised reviews</li>
            </ul>
            <p className="mt-3">We reserve the right to remove reviews that violate these guidelines.</p>
          </Section>

          <Section title="9. Prohibited conduct">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Use Shield HQ for any unlawful purpose</li>
              <li>Provide false or misleading information</li>
              <li>Impersonate another person or misrepresent your qualifications</li>
              <li>Attempt to bypass the platform to arrange work or payment directly</li>
              <li>Harass, threaten, or discriminate against other users</li>
              <li>Interfere with the operation of the platform</li>
              <li>Use automated tools to scrape, collect, or access data from Shield HQ</li>
            </ul>
          </Section>

          <Section title="10. Intellectual property">
            <p>
              The Shield HQ name, logo, and all content, design, and software on the platform are owned by Shield HQ or our licensors. 
              You may not copy, modify, distribute, or create derivative works without our written permission.
            </p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>
              Shield HQ provides a marketplace platform and is not responsible for the conduct of venues or security professionals. 
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>We do not guarantee the availability, quality, or reliability of any user</li>
              <li>We are not liable for any loss or damage arising from the actions of venues or security personnel</li>
              <li>Our total liability to you shall not exceed the fees you have paid to Shield HQ in the preceding 12 months</li>
            </ul>
          </Section>

          <Section title="12. Dispute resolution">
            <p>
              If a dispute arises between a venue and a security professional regarding a booking, we encourage both parties to resolve it directly. 
              Shield HQ may, at its discretion, mediate disputes but is not obligated to do so. 
              For disputes with Shield HQ directly, these Terms are governed by the laws of England and Wales.
            </p>
          </Section>

          <Section title="13. Termination">
            <p>
              You may delete your account at any time through your account settings or by contacting us. 
              We may suspend or terminate your account if you breach these Terms, with or without notice.
            </p>
            <p>
              Upon termination, any outstanding payments owed will still be processed. Sections of these Terms that by their nature should survive termination will continue to apply.
            </p>
          </Section>

          <Section title="14. Changes to these Terms">
            <p>
              We may update these Terms from time to time. When we make material changes, we&apos;ll notify you via email or in-app notification at least 14 days before the changes take effect. 
              Continued use of Shield HQ after changes become effective constitutes acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="15. Contact us">
            <p>If you have any questions about these Terms, contact us at:</p>
            <div className="mt-3 glass rounded-xl p-4">
              <p><strong className="text-white">Shield HQ</strong></p>
              <p>Birmingham, United Kingdom</p>
              <p>Email: <a href="mailto:legal@shieldsecurity.app" className="text-shield-400 hover:text-shield-300">legal@shieldsecurity.app</a></p>
            </div>
          </Section>
        </div>

        <div className="mt-12 text-center text-sm text-zinc-500">
          <Link href="/privacy" className="text-shield-400 hover:text-shield-300">Privacy Policy</Link>
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
