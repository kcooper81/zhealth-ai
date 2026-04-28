import Link from "next/link";
import MermaidDiagram from "@/components/MermaidDiagram";

const ECOSYSTEM_DIAGRAM = `
flowchart LR
  WP["zhealtheducation.com<br/>(WordPress)"]:::active
  TF["zuniversity<br/>(Thinkific)"]:::active
  K["Keap CRM<br/>55,417 contacts"]:::active
  Z["Zapier<br/>(zaps unknown)"]:::unknown
  WC["WooCommerce<br/>still installed"]:::dormant
  GA["GA4<br/>2 properties"]:::active
  CL["Microsoft<br/>Clarity"]:::active

  WP -- form submits --> K
  WP -- product links --> TF
  K -.bridge?.- TF
  TF -- webhooks? --> K
  WP --- WC
  WP -- analytics --> GA
  TF -- analytics --> GA
  WP -- session data --> CL

  classDef active fill:#86efac,stroke:#15803d,color:#052e16
  classDef dormant fill:#fecaca,stroke:#b91c1c,color:#450a0a,stroke-dasharray: 5 3
  classDef unknown fill:#fde68a,stroke:#92400e,color:#451a03
`;

const LEAD_GEN_DIAGRAM = `
flowchart TD
  S1["?<br/>Elementor form"]:::tbd
  S2["?<br/>Pop-up / opt-in"]:::tbd
  S3["?<br/>Find-A-Trainer entry"]:::tbd
  S4["?<br/>Course-curious CTA"]:::tbd
  S5["?<br/>Lead magnet download"]:::tbd

  S1 --> K["Keap contact created<br/>+ tag applied"]
  S2 --> K
  S3 --> K
  S4 --> K
  S5 --> K

  K --> C1["?<br/>Welcome sequence"]:::tbd
  K --> C2["?<br/>Nurture sequence"]:::tbd
  K --> C3["?<br/>Trainer-specific sequence"]:::tbd

  C1 --> O1["Customer<br/>(buys on Thinkific)"]
  C2 --> O1
  C3 --> O1

  classDef tbd fill:#fde68a,stroke:#92400e,color:#451a03,stroke-dasharray: 4 3
`;

const PURCHASE_DIAGRAM = `
flowchart LR
  Browse["Browse zuniversity<br/>(82 courses)"]
  Cart["Thinkific checkout"]
  Pay["Payment processor<br/>(Stripe? other?)"]:::tbd
  Enroll["Course enrollment<br/>(Thinkific)"]
  Access["LMS access granted"]
  Receipt["Receipt email<br/>(source: Thinkific or Keap?)"]:::tbd

  Browse --> Cart --> Pay --> Enroll --> Access
  Pay --> Receipt
  Enroll -. webhook? .-> KeapEvent["Keap: tag<br/>'purchased: <course>'"]:::tbd

  classDef tbd fill:#fde68a,stroke:#92400e,color:#451a03,stroke-dasharray: 4 3
`;

const LIFECYCLE_DIAGRAM = `
flowchart TD
  Buy["Customer buys course"] --> Onboard["?<br/>Onboarding sequence"]:::tbd
  Onboard --> Use["LMS engagement<br/>(progress tracked in Thinkific)"]
  Use --> Complete["Course completion"]
  Complete --> Cert["?<br/>Certificate / next-step offer"]:::tbd
  Cert --> Upsell["?<br/>Upsell sequence"]:::tbd

  Use --> Stalled["?<br/>Stalled-learner re-engagement"]:::tbd
  Buy --> Refund["?<br/>Refund flow"]:::tbd

  classDef tbd fill:#fde68a,stroke:#92400e,color:#451a03,stroke-dasharray: 4 3
`;

function StatusBadge({ kind }: { kind: "active" | "dormant" | "unknown" | "tbd" }) {
  const map = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    dormant: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    unknown: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    tbd: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  const label = { active: "Active", dormant: "Dormant", unknown: "Unknown", tbd: "TBD" }[kind];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map[kind]}`}>
      {label}
    </span>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-gray-200 py-10 dark:border-gray-800">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}

function PlaceholderTable({ columns, note }: { columns: string[]; note: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-[#202022]">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Inventory placeholder
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {columns.map((c) => (
          <span
            key={c}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-[#1c1c1e] dark:text-gray-300"
          >
            {c}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{note}</p>
    </div>
  );
}

export const metadata = {
  title: "Customer Flows — Z-Health Portal",
};

export default function CustomerFlowsPage() {
  const updatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 text-gray-900 dark:text-gray-100">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-brand-blue dark:text-gray-400"
          >
            ← Back to chat
          </Link>
          <span className="text-xs text-gray-400 dark:text-gray-500">Updated {updatedAt} PT</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Customer Flows</h1>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Cross-system map of how leads, customers, and orders move between WordPress, Keap, and
          Thinkific. Part of the internal Z-Health team portal.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge kind="active" /> currently in use
          <StatusBadge kind="dormant" /> installed but unused
          <StatusBadge kind="unknown" /> behavior not yet verified
          <StatusBadge kind="tbd" /> placeholder, awaiting data pass
        </div>
        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <a href="#ecosystem" className="text-brand-blue hover:underline">Ecosystem map</a>
          <a href="#lead-gen" className="text-brand-blue hover:underline">Lead generation</a>
          <a href="#purchase" className="text-brand-blue hover:underline">Purchase</a>
          <a href="#lifecycle" className="text-brand-blue hover:underline">Lifecycle / post-purchase</a>
          <a href="#dormant" className="text-brand-blue hover:underline">Dormant stack</a>
          <a href="#open-questions" className="text-brand-blue hover:underline">Open questions</a>
        </nav>
      </header>

      <Section
        id="ecosystem"
        title="Ecosystem map"
        subtitle="Every system in the customer journey, color-coded by current usage"
      >
        <MermaidDiagram chart={ECOSYSTEM_DIAGRAM} caption="High-level system topology" />
        <ul className="ml-5 list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>
            <strong>WordPress</strong> at zhealtheducation.com — content, blog, trainer pages, lead
            capture. <StatusBadge kind="active" />
          </li>
          <li>
            <strong>Thinkific</strong> at zuniversity.zhealtheducation.com — sole ecommerce + LMS,
            82 courses. <StatusBadge kind="active" />
          </li>
          <li>
            <strong>Keap</strong> — CRM and email automation, 55,417 contacts.{" "}
            <StatusBadge kind="active" />
          </li>
          <li>
            <strong>WooCommerce</strong> — installed and active in WP, but no longer used for sales.{" "}
            <StatusBadge kind="dormant" />
          </li>
          <li>
            <strong>Zapier</strong> — connectors visible in WP namespace; specific zaps not yet
            mapped. <StatusBadge kind="unknown" />
          </li>
          <li>
            <strong>GA4</strong> — two properties (website 336619240, LMS 507907472).{" "}
            <StatusBadge kind="active" />
          </li>
          <li>
            <strong>Microsoft Clarity</strong> — heatmaps + session recordings.{" "}
            <StatusBadge kind="active" />
          </li>
        </ul>
      </Section>

      <Section
        id="lead-gen"
        title="1. Lead generation"
        subtitle="How prospects enter the system from the WP marketing site"
      >
        <MermaidDiagram chart={LEAD_GEN_DIAGRAM} caption="Lead capture → Keap → email sequence" />
        <PlaceholderTable
          columns={["Form / source", "WP page", "Keap tag", "Campaign triggered", "30-day volume", "Status"]}
          note="To be populated in pass 1: Elementor forms, popups, opt-ins, trainer-finder entries, lead magnets."
        />
      </Section>

      <Section
        id="purchase"
        title="2. Purchase"
        subtitle="Course purchase entirely on Thinkific (Woo deprecated for sales)"
      >
        <MermaidDiagram chart={PURCHASE_DIAGRAM} caption="Browse → checkout → enrollment → receipt" />
        <PlaceholderTable
          columns={["Course / bundle", "Price", "Sign-up URL", "Linked Keap tag", "30-day enrollments", "Status"]}
          note="To be populated in pass 1: full Thinkific catalog with public sign-up URLs and Keap-side mirroring."
        />
      </Section>

      <Section
        id="lifecycle"
        title="3. Lifecycle / post-purchase"
        subtitle="Onboarding, engagement, completion, refunds, win-back"
      >
        <MermaidDiagram chart={LIFECYCLE_DIAGRAM} caption="What happens after the sale" />
        <PlaceholderTable
          columns={["Sequence name", "Trigger", "Audience", "Steps", "Last sent", "Status"]}
          note="To be populated in pass 1: every Keap campaign and Thinkific automation that fires post-purchase."
        />
      </Section>

      <Section
        id="dormant"
        title="Dormant stack — candidates for cleanup"
        subtitle="Code and data shapes still present from previous business decisions"
      >
        <ul className="ml-5 list-disc space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>
            <strong>WooCommerce 10.7.0</strong> + Custom Product Tabs + WC Zapier + Meta for
            WooCommerce + WC Telemetry — installed and active in WordPress, but business no longer
            sells through Woo. Security surface, performance cost, and confusion risk.{" "}
            <StatusBadge kind="dormant" />
          </li>
          <li>
            <strong>Follow-Up Emails</strong> — already inactive. Listed for completeness.
          </li>
          <li>
            <strong>WPForms Lite</strong> — inactive. If Elementor forms cover all lead capture,
            safe to remove.
          </li>
        </ul>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Recommendation: don&apos;t deactivate Woo until pass 1 confirms there are no checkout
          links still pointing at <code>/cart</code> or <code>/checkout</code> URLs.
        </p>
      </Section>

      <Section
        id="open-questions"
        title="Open questions"
        subtitle="Answers required before the audit can be considered complete"
      >
        <ol className="ml-5 list-decimal space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>What is the primary lead-gen path: WP form → Keap → Thinkific, or WP link → Thinkific direct?</li>
          <li>How does a Thinkific purchase create / update a Keap contact? Native integration, Zapier, or custom code in z-hralth plugin?</li>
          <li>Where do receipt emails originate — Thinkific, Keap, or both?</li>
          <li>Is the &quot;Find A Trainer&quot; flow a separate funnel, or merged with student lead gen?</li>
          <li>Are any Zapier zaps that should be running currently broken or paused?</li>
          <li>What does the refund flow touch in Keap (tag changes, sequence pauses)?</li>
        </ol>
      </Section>
    </main>
  );
}
