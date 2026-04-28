import MermaidDiagram from "@/components/MermaidDiagram";
import Section, { Card } from "@/components/portal/Section";
import Tabs, { TabPanel } from "@/components/portal/Tabs";

export const dynamic = "force-dynamic";

const ECOSYSTEM_DIAGRAM = `
flowchart TD
  WP["zhealtheducation.com<br/>(WordPress)"]:::appleGreen
  TF["zuniversity<br/>(Thinkific)"]:::appleGreen
  K["Keap CRM<br/>55,417 contacts"]:::appleGreen
  Z["Zapier<br/>(zaps unknown)"]:::appleAmber
  WC["WooCommerce<br/>(installed, unused)"]:::appleSlate
  GA["GA4<br/>(2 properties)"]:::appleBlue
  CL["Microsoft Clarity"]:::appleBlue

  WP -- "form submits" --> K
  WP -- "product links" --> TF
  K -. "bridge?" .- TF
  TF -- "webhooks?" --> K
  WP --- WC
  WP -- "analytics" --> GA
  TF -- "analytics" --> GA
  WP -- "session data" --> CL

  classDef appleBlue fill:#eff6ff,stroke:#3b82f6,color:#1e40af,stroke-width:1.5px
  classDef appleGreen fill:#ecfdf5,stroke:#10b981,color:#065f46,stroke-width:1.5px
  classDef appleAmber fill:#fffbeb,stroke:#f59e0b,color:#92400e,stroke-width:1.5px
  classDef appleSlate fill:#f8fafc,stroke:#94a3b8,color:#475569,stroke-width:1.5px,stroke-dasharray:4 3
`;

const LEAD_GEN_DIAGRAM = `
flowchart TD
  S1["Elementor form<br/>(unconfirmed)"]:::appleAmber
  S2["Pop-up / opt-in<br/>(unconfirmed)"]:::appleAmber
  S3["Find-A-Trainer entry<br/>(unconfirmed)"]:::appleAmber
  S4["Course-curious CTA<br/>(unconfirmed)"]:::appleAmber
  S5["Lead magnet download<br/>(unconfirmed)"]:::appleAmber

  S1 --> K["Keap contact<br/>+ tag applied"]:::appleGreen
  S2 --> K
  S3 --> K
  S4 --> K
  S5 --> K

  K --> C1["Welcome sequence"]:::appleAmber
  K --> C2["Nurture sequence"]:::appleAmber
  K --> C3["Trainer-specific sequence"]:::appleAmber

  C1 --> O1["Customer buys<br/>on Thinkific"]:::applePurple
  C2 --> O1
  C3 --> O1

  classDef appleGreen fill:#ecfdf5,stroke:#10b981,color:#065f46,stroke-width:1.5px
  classDef appleAmber fill:#fffbeb,stroke:#f59e0b,color:#92400e,stroke-width:1.5px,stroke-dasharray:4 3
  classDef applePurple fill:#f5f3ff,stroke:#8b5cf6,color:#5b21b6,stroke-width:1.5px
`;

const PURCHASE_DIAGRAM = `
flowchart TD
  Browse["Browse zuniversity<br/>(82 courses)"]:::appleBlue
  Cart["Thinkific checkout"]:::appleGreen
  Pay["Payment processor<br/>(Stripe? other?)"]:::appleAmber
  Enroll["Course enrollment"]:::appleGreen
  Access["LMS access granted"]:::appleGreen
  Receipt["Receipt email<br/>(source TBD)"]:::appleAmber
  KeapEvent["Keap tag<br/>'purchased'"]:::appleAmber

  Browse --> Cart --> Pay --> Enroll --> Access
  Pay --> Receipt
  Enroll -. "webhook?" .-> KeapEvent

  classDef appleBlue fill:#eff6ff,stroke:#3b82f6,color:#1e40af,stroke-width:1.5px
  classDef appleGreen fill:#ecfdf5,stroke:#10b981,color:#065f46,stroke-width:1.5px
  classDef appleAmber fill:#fffbeb,stroke:#f59e0b,color:#92400e,stroke-width:1.5px,stroke-dasharray:4 3
`;

const LIFECYCLE_DIAGRAM = `
flowchart TD
  Buy["Customer buys course"]:::appleGreen --> Onboard["Onboarding sequence"]:::appleAmber
  Onboard --> Use["LMS engagement<br/>(progress tracked)"]:::applePurple
  Use --> Complete["Course completion"]:::applePurple
  Complete --> Cert["Certificate /<br/>next-step offer"]:::appleAmber
  Cert --> Upsell["Upsell sequence"]:::appleAmber

  Use --> Stalled["Stalled-learner<br/>re-engagement"]:::appleAmber
  Buy --> Refund["Refund flow"]:::appleAmber

  classDef appleGreen fill:#ecfdf5,stroke:#10b981,color:#065f46,stroke-width:1.5px
  classDef appleAmber fill:#fffbeb,stroke:#f59e0b,color:#92400e,stroke-width:1.5px,stroke-dasharray:4 3
  classDef applePurple fill:#f5f3ff,stroke:#8b5cf6,color:#5b21b6,stroke-width:1.5px
`;

function StatusPill({
  kind,
  children,
}: {
  kind: "active" | "dormant" | "unknown" | "tbd";
  children: React.ReactNode;
}) {
  const styles = {
    active:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    dormant: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
    unknown:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    tbd: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[kind]}`}
    >
      {children}
    </span>
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
    <main className="mx-auto max-w-7xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Customer Flows
          </h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {updatedAt} PT
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Cross-system map of how leads, customers, and orders move between WordPress, Keap, and
          Thinkific. Click any diagram to expand.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <StatusPill kind="active">In use</StatusPill>
          <StatusPill kind="dormant">Installed but unused</StatusPill>
          <StatusPill kind="unknown">Behavior unverified</StatusPill>
          <StatusPill kind="tbd">Awaiting data pass</StatusPill>
        </div>
      </header>

      <Tabs
        tabs={[
          { id: "ecosystem", label: "Ecosystem" },
          { id: "lead-gen", label: "Lead generation" },
          { id: "purchase", label: "Purchase" },
          { id: "lifecycle", label: "Lifecycle" },
          { id: "dormant", label: "Dormant stack" },
          { id: "questions", label: "Open questions", badge: 6 },
        ]}
      >
        <TabPanel id="ecosystem">
          <Section
            title="Every system in the customer journey"
            description="Color-coded by current usage. Hover any diagram to expand it."
          >
            <MermaidDiagram chart={ECOSYSTEM_DIAGRAM} caption="High-level system topology" />
          </Section>
          <Section title="Systems inventory">
            <Card>
              <ul className="space-y-3 text-sm">
                <li className="flex items-baseline gap-2">
                  <StatusPill kind="active">Active</StatusPill>
                  <span><strong>WordPress</strong> at zhealtheducation.com — content, blog, trainer pages, lead capture.</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <StatusPill kind="active">Active</StatusPill>
                  <span><strong>Thinkific</strong> at zuniversity.zhealtheducation.com — sole ecommerce + LMS, 82 courses.</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <StatusPill kind="active">Active</StatusPill>
                  <span><strong>Keap</strong> — CRM and email automation, 55,417 contacts.</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <StatusPill kind="dormant">Dormant</StatusPill>
                  <span><strong>WooCommerce</strong> — installed and active in WP, but no longer used for sales.</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <StatusPill kind="unknown">Unknown</StatusPill>
                  <span><strong>Zapier</strong> — connectors visible in WP namespace; specific zaps not yet mapped.</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <StatusPill kind="active">Active</StatusPill>
                  <span><strong>GA4</strong> — two properties (website 336619240, LMS 507907472).</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <StatusPill kind="active">Active</StatusPill>
                  <span><strong>Microsoft Clarity</strong> — heatmaps + session recordings.</span>
                </li>
              </ul>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="lead-gen">
          <Section
            title="How prospects enter the system"
            description="From the WP marketing site → Keap → email sequence → Thinkific customer."
          >
            <MermaidDiagram chart={LEAD_GEN_DIAGRAM} caption="Lead capture → Keap → email sequence" />
          </Section>
          <Section title="Lead-gen inventory" description="To be populated from real data in pass 1.">
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Will list every Elementor form, popup, opt-in, trainer-finder entry, and lead
                magnet — with the WP page they live on, the Keap tag they apply, the campaign they
                trigger, and 30-day volume.
              </p>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="purchase">
          <Section
            title="Course purchase entirely on Thinkific"
            description="WooCommerce is dormant for sales."
          >
            <MermaidDiagram chart={PURCHASE_DIAGRAM} caption="Browse → checkout → enrollment → receipt" />
          </Section>
          <Section title="Purchase inventory" description="To be populated from real data in pass 1.">
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Will list the full Thinkific catalog with public sign-up URLs, prices, linked Keap
                tags, and 30-day enrollment counts.
              </p>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="lifecycle">
          <Section
            title="Onboarding, engagement, completion, refunds, win-back"
            description="What happens after the sale."
          >
            <MermaidDiagram chart={LIFECYCLE_DIAGRAM} caption="Post-purchase journey" />
          </Section>
          <Section title="Lifecycle sequences inventory">
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Will list every Keap campaign and Thinkific automation that fires post-purchase —
                trigger, audience, step count, last-sent date.
              </p>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="dormant">
          <Section
            title="Dormant stack — candidates for cleanup"
            description="Code and data shapes still present from previous business decisions."
          >
            <Card>
              <ul className="space-y-3 text-sm">
                <li>
                  <div className="flex items-baseline gap-2">
                    <StatusPill kind="dormant">Dormant</StatusPill>
                    <strong>WooCommerce 10.7.0</strong>
                  </div>
                  <p className="mt-1 ml-1 text-gray-600 dark:text-gray-400">
                    Plus Custom Product Tabs, WC Zapier, Meta for WooCommerce, WC Telemetry —
                    installed and active in WordPress, but business no longer sells through Woo.
                    Security surface, performance cost, and confusion risk.
                  </p>
                </li>
                <li>
                  <div className="flex items-baseline gap-2">
                    <StatusPill kind="dormant">Inactive</StatusPill>
                    <strong>Follow-Up Emails</strong>
                  </div>
                  <p className="mt-1 ml-1 text-gray-600 dark:text-gray-400">
                    Already deactivated. Listed for completeness.
                  </p>
                </li>
                <li>
                  <div className="flex items-baseline gap-2">
                    <StatusPill kind="dormant">Inactive</StatusPill>
                    <strong>WPForms Lite</strong>
                  </div>
                  <p className="mt-1 ml-1 text-gray-600 dark:text-gray-400">
                    Inactive. If Elementor forms cover all lead capture, safe to remove.
                  </p>
                </li>
              </ul>
              <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>Recommendation:</strong> don&apos;t deactivate Woo until pass 1 confirms
                there are no checkout links still pointing at <code>/cart</code> or{" "}
                <code>/checkout</code> URLs.
              </p>
            </Card>
          </Section>
        </TabPanel>

        <TabPanel id="questions">
          <Section
            title="Open questions"
            description="Answers required before the audit can be considered complete."
          >
            <Card>
              <ol className="ml-5 list-decimal space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <li>What is the primary lead-gen path: WP form → Keap → Thinkific, or WP link → Thinkific direct?</li>
                <li>How does a Thinkific purchase create / update a Keap contact? Native integration, Zapier, or custom code in z-hralth plugin?</li>
                <li>Where do receipt emails originate — Thinkific, Keap, or both?</li>
                <li>Is the &quot;Find A Trainer&quot; flow a separate funnel, or merged with student lead gen?</li>
                <li>Are any Zapier zaps that should be running currently broken or paused?</li>
                <li>What does the refund flow touch in Keap (tag changes, sequence pauses)?</li>
              </ol>
            </Card>
          </Section>
        </TabPanel>
      </Tabs>
    </main>
  );
}
