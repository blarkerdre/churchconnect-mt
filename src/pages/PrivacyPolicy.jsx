import React from "react";
import { Card } from "@/components/ui/card";
import { Shield, Mail, Calendar, Database, Users, FileText, Globe, Lock } from "lucide-react";

const Section = ({ icon: Icon, title, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[#1e3a5f]" />
      </div>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
    </div>
    <div className="pl-10 text-sm text-slate-600 leading-relaxed space-y-2">
      {children}
    </div>
  </div>
);

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#1e3a5f] mb-3">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Privacy Policy</h1>
        <p className="text-sm text-slate-500">Church Management Suite · Winners Chapel International Cardiff</p>
        <p className="text-xs text-slate-400">Last updated: March 2026</p>
      </div>

      <Card className="border-0 shadow-sm p-6 space-y-8">

        {/* Intro */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 leading-relaxed">
          We are committed to protecting your personal information and being transparent about how we use it.
          This Privacy Policy explains what data we collect, why we collect it, and your rights under UK data
          protection law, including the UK General Data Protection Regulation (UK GDPR) and the Data Protection
          Act 2018.
        </div>

        {/* 1. Data Controller */}
        <Section icon={Users} title="1. Who We Are (Data Controller)">
          <p>
            The data controller responsible for your personal information is:
          </p>
          <div className="bg-slate-50 rounded-xl p-4 space-y-1 border border-slate-100">
            <p className="font-semibold text-slate-700">Winners Chapel International Cardiff</p>
            <p>Operating Church Management Suite</p>
            <p>Email: <a href="mailto:kugbiyiadeniyi@gmail.com" className="text-[#1e3a5f] underline">kugbiyiadeniyi@gmail.com</a></p>
            <p>ICO Registration Number: <span className="font-medium">ICO Number</span></p>
          </div>
          <p>
            If you have any questions about this policy or how we handle your data, please contact us at the
            email address above.
          </p>
        </Section>

        {/* 2. What We Collect */}
        <Section icon={Database} title="2. What Personal Data We Collect">
          <p>We collect and process the following categories of personal data:</p>

          <div className="space-y-3">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 font-medium text-slate-700 text-xs uppercase tracking-wide">Personal Details</div>
              <ul className="px-4 py-3 space-y-1 list-disc list-inside">
                <li>Full name, date of birth, and gender</li>
                <li>Contact details: email address, phone number, home address</li>
                <li>Marital status</li>
                <li>Emergency contact information</li>
                <li>Profile photograph (if provided)</li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 font-medium text-slate-700 text-xs uppercase tracking-wide">Church Membership & Engagement</div>
              <ul className="px-4 py-3 space-y-1 list-disc list-inside">
                <li>Membership status and join date</li>
                <li>Church unit/ministry involvement</li>
                <li>Attendance records for services and meetings</li>
                <li>Event registrations and participation history</li>
              </ul>
            </div>

            <div className="border border-amber-200 rounded-xl overflow-hidden">
              <div className="bg-amber-50 px-4 py-2 font-medium text-amber-800 text-xs uppercase tracking-wide">Special Category Data (Sensitive)</div>
              <ul className="px-4 py-3 space-y-1 list-disc list-inside text-slate-600">
                <li>Religious belief and faith journey details (salvation date, baptism records)</li>
                <li>Pastoral counselling and care notes</li>
                <li>Welfare and personal support information</li>
              </ul>
              <p className="px-4 pb-3 text-xs text-amber-700">
                This is <strong>special category data</strong> under UK GDPR (Article 9). We only process this with your explicit consent.
              </p>
            </div>
          </div>
        </Section>

        {/* 3. Legal Basis */}
        <Section icon={FileText} title="3. Our Legal Basis for Processing">
          <p>
            We rely on the following legal bases under UK GDPR to process your personal data:
          </p>
          <div className="space-y-3">
            <div className="border-l-4 border-[#1e3a5f] pl-4 py-1">
              <p className="font-medium text-slate-700">Explicit Consent (Article 6(1)(a) and Article 9(2)(a))</p>
              <p className="text-slate-500 mt-0.5">For all special category data — including religious beliefs, pastoral care notes, and faith records — we rely on your <strong>explicit, freely given consent</strong>. You may withdraw this consent at any time.</p>
            </div>
            <div className="border-l-4 border-[#c9a84c] pl-4 py-1">
              <p className="font-medium text-slate-700">Legitimate Interests (Article 6(1)(f))</p>
              <p className="text-slate-500 mt-0.5">For general church administration, communications, and member care, where our interests do not override your fundamental rights.</p>
            </div>
            <div className="border-l-4 border-slate-300 pl-4 py-1">
              <p className="font-medium text-slate-700">Vital Interests (Article 6(1)(d))</p>
              <p className="text-slate-500 mt-0.5">In emergency situations, we may process data to protect the vital interests of a member (e.g., sharing emergency contact details).</p>
            </div>
          </div>
        </Section>

        {/* 4. How We Use Your Data */}
        <Section icon={Users} title="4. How We Use Your Data">
          <p>We use your personal data to:</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>Manage church membership records and directories</li>
            <li>Track attendance at services and unit meetings</li>
            <li>Send pastoral care, follow-up communications, and prayer support</li>
            <li>Organise and communicate church events and activities</li>
            <li>Provide welfare and transport support where requested</li>
            <li>Send absence reminders and engagement notifications</li>
            <li>Comply with our safeguarding responsibilities</li>
          </ul>
          <p className="text-slate-500 text-xs mt-2">
            We will never sell, rent, or share your personal data with third parties for marketing purposes.
          </p>
        </Section>

        {/* 5. Data Storage */}
        <Section icon={Globe} title="5. Where Your Data Is Stored">
          <p>
            Your personal data is stored and processed on servers located in the <strong>United States</strong>,
            provided by our software platform (Base44). International data transfers are protected by
            appropriate safeguards, including:
          </p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>Standard Contractual Clauses (SCCs) approved by the UK Information Commissioner's Office (ICO)</li>
            <li>The UK International Data Transfer Agreement (IDTA) where applicable</li>
            <li>Technical security measures including encryption in transit and at rest</li>
          </ul>
          <p>
            By using this system, you acknowledge that your data may be transferred outside the UK under these
            safeguards.
          </p>
        </Section>

        {/* 6. Retention */}
        <Section icon={Calendar} title="6. How Long We Keep Your Data">
          <p>
            We retain your personal data for the duration of your active membership plus <strong>2 years</strong>
            after your membership ends or becomes inactive.
          </p>
          <p>
            After this period, your personal data will be securely deleted or anonymised, unless we are required
            by law to retain it for longer (e.g., for safeguarding or legal obligations).
          </p>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 border border-slate-100">
            <strong>Special note on pastoral care and counselling records:</strong> These may be retained for
            longer periods where required by our safeguarding policy or legal duty of care obligations.
          </div>
        </Section>

        {/* 7. Your Rights */}
        <Section icon={Lock} title="7. Your Rights Under UK GDPR">
          <p>You have the following rights regarding your personal data:</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { right: "Right of Access", desc: "Request a copy of the personal data we hold about you." },
              { right: "Right to Rectification", desc: "Ask us to correct inaccurate or incomplete data." },
              { right: "Right to Erasure", desc: "Request deletion of your personal data ('right to be forgotten')." },
              { right: "Right to Portability", desc: "Receive your data in a machine-readable format to transfer elsewhere." },
              { right: "Right to Withdraw Consent", desc: "Withdraw consent for special category data at any time, without affecting previous processing." },
              { right: "Right to Object", desc: "Object to processing based on legitimate interests." },
            ].map(({ right, desc }) => (
              <div key={right} className="border border-slate-200 rounded-xl p-3">
                <p className="font-semibold text-slate-700 text-xs">{right}</p>
                <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-2">
            To exercise any of these rights, please contact us at{" "}
            <a href="mailto:kugbiyiadeniyi@gmail.com" className="text-[#1e3a5f] underline">kugbiyiadeniyi@gmail.com</a>.
            We will respond within <strong>one month</strong> as required by UK GDPR.
          </p>
        </Section>

        {/* 8. Complaints */}
        <Section icon={Mail} title="8. How to Make a Complaint">
          <p>
            If you are unhappy with how we have handled your personal data, you have the right to lodge a
            complaint with the <strong>Information Commissioner's Office (ICO)</strong> — the UK's independent
            data protection authority.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1 text-sm">
            <p className="font-medium text-slate-700">Information Commissioner's Office</p>
            <p>Website: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-[#1e3a5f] underline">ico.org.uk</a></p>
            <p>Helpline: 0303 123 1113</p>
          </div>
          <p>
            We would, however, appreciate the opportunity to address your concerns before you contact the ICO,
            so please reach out to us first.
          </p>
        </Section>

        {/* 9. Changes */}
        <Section icon={FileText} title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Any changes will be communicated to members
            through the church management system. The "last updated" date at the top of this page will always
            reflect the most recent version.
          </p>
        </Section>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400 space-y-1">
          <p>Winners Chapel International Cardiff — Church Management Suite</p>
          <p>
            Questions? Email us at{" "}
            <a href="mailto:kugbiyiadeniyi@gmail.com" className="text-[#1e3a5f] underline">kugbiyiadeniyi@gmail.com</a>
          </p>
        </div>

      </Card>
    </div>
  );
}