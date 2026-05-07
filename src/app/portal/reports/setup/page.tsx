/**
 * Tracking Setup — copy-paste snippets that wire WP + Thinkific + Keap
 * into the GA4 properties this portal reads. Once these are in place,
 * the Channels / Landing Pages / Courses / Emails / Funnels reports
 * have data to pivot.
 */
import Section, { Card } from "@/components/portal/Section";
import CodeBlock from "@/components/portal/CodeBlock";
import TrackingInstaller from "@/components/portal/TrackingInstaller";
import StepStatus from "@/components/portal/StepStatus";
import { verifySetup } from "@/lib/wp-tracking-installer";
import { LANDING_PAGE_TAG_MAP } from "@/lib/landing-page-tag-map";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tracking Setup — Z-Health Portal" };

const GA4_WEBSITE = "G-2BGQW8MGVJ";
// Thinkific GA4 ID — populate on the Thinkific site if not already set.
// We mirror the website ID so cross-domain user_id matching works.
const GA4_LMS_NOTE = "Use the same G-2BGQW8MGVJ on Thinkific so a single user is one user across both domains. (You can keep a separate property for the LMS if you also need it; this just adds a second tag.)";


const THINKIFIC_HEAD = `<!-- Z-Health: capture UTM + landing context that came in from the website
     and forward standard ecommerce events to GA4. Paste into Thinkific:
     Settings → Code & Analytics → Site Footer Code (or Header Code). -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_WEBSITE}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA4_WEBSITE}', {
    // Same measurement ID as the website → cross-domain attribution
    cookie_domain: 'auto',
    linker: { domains: ['zhealtheducation.com', 'courses.zhealtheducation.com'] }
  });

  (function () {
    var url = new URL(window.location.href);
    var first = {};
    try {
      first = JSON.parse(sessionStorage.getItem('zh_first_touch') || '{}');
    } catch(e){}

    // Carry over UTM if present in URL (from website's auto-tagged links)
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','promo'].forEach(function(k){
      var v = url.searchParams.get(k);
      if (v) first[k === 'promo' ? 'promo_id' : k] = v;
    });
    sessionStorage.setItem('zh_first_touch', JSON.stringify(first));

    function send(name, params) {
      gtag('event', name, Object.assign({
        utm_source:   first.utm_source   || '',
        utm_medium:   first.utm_medium   || '',
        utm_campaign: first.utm_campaign || '',
        utm_content:  first.utm_content  || '',
        promo_id:     first.promo_id     || ''
      }, params || {}));
    }

    // course_view: any /courses/<slug> page
    var m = url.pathname.match(/^\\/courses\\/([^/]+)/);
    if (m) send('course_view', { course_slug: m[1] });

    // begin_checkout: /enroll or /buy or /checkout pages
    if (/\\/(enroll|checkout|buy)\\b/.test(url.pathname)) {
      send('begin_checkout', { checkout_path: url.pathname });
    }

    // sign_up: account creation page
    if (/\\/sign[-_]?up|\\/account\\/new/.test(url.pathname)) {
      send('sign_up_view', { signup_path: url.pathname });
    }

    // purchase: Thinkific's order success URL pattern
    // (Thinkific exposes order id + product info on this page in URL)
    var orderM = url.pathname.match(/\\/order_(?:thank_yous|completes)\\/(\\w+)/);
    if (orderM) {
      send('purchase', {
        transaction_id: orderM[1],
        currency: 'USD',
        value: parseFloat(url.searchParams.get('amount') || '0')
      });
    }
  })();
</script>`;

const GTM_VARIABLES = `Variables to create in GTM (one-time):

  Data Layer Variable    Name in GTM             Layer key
  --------------------   ----------------------  ----------------
  DLV — landing_path     dlv.landing_path        landing_path
  DLV — utm_source       dlv.utm_source          utm_source
  DLV — utm_medium       dlv.utm_medium          utm_medium
  DLV — utm_campaign     dlv.utm_campaign        utm_campaign
  DLV — promo_id         dlv.promo_id            promo_id
  DLV — cta_id           dlv.cta_id              cta_id
  DLV — cta_text         dlv.cta_text            cta_text
  DLV — cta_href         dlv.cta_href            cta_href
  DLV — destination_host dlv.destination_host    destination_host
  DLV — course_slug      dlv.course_slug         course_slug
  DLV — form_id          dlv.form_id             form_id
  DLV — lead_magnet      dlv.lead_magnet         lead_magnet`;

const GTM_TRIGGERS_TAGS = `Triggers (Custom Event in GTM):

  Trigger name             Custom Event name
  ---------------------    ------------------
  Custom — cta_click       cta_click
  Custom — form_submit     form_submit
  Custom — outbound_click  outbound_click
  Custom — enroll_click    enroll_click
  Custom — page_context    page_context

Tags (one GA4 Event tag per trigger, all firing into G-2BGQW8MGVJ):

  Tag name                       Event name        Event params
  ------------------------------ ----------------- ---------------------------------
  GA4 — cta_click                cta_click         cta_id, cta_text, cta_href,
                                                   landing_path, utm_*, promo_id
  GA4 — form_submit              form_submit       form_id, lead_magnet,
                                                   landing_path, utm_*, promo_id
  GA4 — outbound_click           outbound_click    destination_host, landing_path,
                                                   utm_*, promo_id
  GA4 — enroll_click             enroll_click      course_slug, destination_host,
                                                   landing_path, utm_*, promo_id

Then mark these as Conversions in GA4:
  enroll_click, form_submit, purchase, begin_checkout`;

const KEAP_LP_TAG_MAP = `// src/lib/landing-page-tag-map.ts (already created — extend as needed)

export const LANDING_PAGE_TAG_MAP = [
  { path: '/lower-back',          tagId: 6499, label: 'Low Back BBPG landing' },
  { path: '/free-webinar',        tagId: 6685, label: 'Free Webinar live signup' },
  { path: '/free-webinar-replay', tagId: 6705, label: 'Free Webinar replay signup' },
  { path: '/blog',                tagId: 5979, label: 'Weekly blog footer' },
  { path: '/neurofundamentals',   tagId: 5035, label: 'NeuroFundamentals e-book' },
];`;

export default async function TrackingSetupPage() {
  const status = await verifySetup().catch(() => null);

  // Step 1: GA4 + GTM both load on the WP site
  const step1Ok = status ? (status.ga4LoadedOnSite && status.gtmLoadedOnSite) : null;
  // Step 2: TrackingInstaller already shows its own status — but we still
  //   give the section a chip reflecting the live-on-site state.
  const step2Ok = status ? status.trackingLiveOnSite : null;
  // Step 4: Thinkific has our snippet (linker config + events fire)
  const step4Ok = status ? (status.thinkificLinked && status.thinkificEvents) : null;
  // Step 5: GTM config — can't verify automatically (would need GTM API auth),
  //   so this is always "Manual step".
  const step5Ok = null;
  // Step 6: at least one row in the map
  const step6Ok = LANDING_PAGE_TAG_MAP.length > 0;

  const allReady = step1Ok && step2Ok && step4Ok && step6Ok;

  return (
    <main className="mx-auto max-w-5xl px-8 py-12">
      <header className="mb-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Tracking Setup
          </h1>
          <StepStatus
            ok={allReady ? true : status ? false : null}
            label={
              allReady
                ? "All checks passing"
                : status
                ? "Action needed"
                : "Verifying…"
            }
          />
        </div>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          One-time wiring that powers every report under <strong>Reports</strong>.
          Each step shows a green check when verified live on the site.
        </p>
      </header>

      <Section
        title="Step 1 · Confirm GA4 IDs"
        description="Identifiers used across the stack — verified by fetching zhealtheducation.com and looking for the IDs in <head>."
        action={<StepStatus ok={step1Ok} label={step1Ok ? "Both loaded" : step1Ok === false ? "Missing on site" : undefined} />}
      >
        <Card>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Website measurement ID</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="font-mono text-base text-gray-900 dark:text-gray-100">{GA4_WEBSITE}</span>
                <StepStatus ok={status?.ga4LoadedOnSite ?? null} label={status?.ga4LoadedOnSite ? "Loaded" : "Not detected"} />
              </dd>
              <dd className="text-xs text-gray-500">should be active on zhealtheducation.com</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">GTM container</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="font-mono text-base text-gray-900 dark:text-gray-100">GTM-57LMTDX</span>
                <StepStatus ok={status?.gtmLoadedOnSite ?? null} label={status?.gtmLoadedOnSite ? "Loaded" : "Not detected"} />
              </dd>
              <dd className="text-xs text-gray-500">manage events here</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>Thinkific note:</strong> {GA4_LMS_NOTE}
          </p>
        </Card>
      </Section>

      <Section
        title="Step 2 · Install tracking on WordPress"
        description="One click pushes the canonical tracking snippet into the WP site as an Elementor Custom Code in <head>, and purges the SiteGround cache so it goes live immediately. No copy-paste needed."
        action={<StepStatus ok={step2Ok} label={step2Ok ? "Live on site" : step2Ok === false ? "Not live" : undefined} />}
      >
        <TrackingInstaller />
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
          The script captures session UTM/landing context, fires custom GA4
          dataLayer events for CTA / form / outbound / enroll, and auto-tags
          outbound Thinkific links with utm_*. To customize, edit
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-white/10">src/lib/wp-tracking-installer.ts</code>
          and click <strong>Re-push to WP</strong>.
        </p>
      </Section>

      <Section
        title="Step 4 · Thinkific code injection"
        description="Paste into Thinkific → Settings → Code & Analytics → Site Footer Code. Verified by fetching the LMS homepage and checking for our cross-domain linker + course_view / begin_checkout / purchase event hooks."
        action={<StepStatus ok={step4Ok} label={step4Ok ? "Live on Thinkific" : step4Ok === false ? "Not detected" : undefined} />}
      >
        {step4Ok && (
          <Card className="mb-4 border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <p className="text-sm text-emerald-900 dark:text-emerald-200">
              <strong>Verified on Thinkific.</strong> Cross-domain linker is configured and{" "}
              <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/30">course_view</code>,{" "}
              <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/30">begin_checkout</code>, and{" "}
              <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/30">purchase</code> events
              are wired. The snippet below stays here in case you ever need to re-paste it.
            </p>
          </Card>
        )}
        <CodeBlock language="html" code={THINKIFIC_HEAD} />
      </Section>

      <Section
        title="Step 5 · GTM configuration (one-time)"
        description="Map dataLayer keys → GA4 event params. Once this is set, every event auto-carries cta / form / utm / promo / course context."
        action={<StepStatus ok={step5Ok} label="Manual — verify in GTM" />}
      >
        <Card>
          <CodeBlock language="text" code={GTM_VARIABLES} />
          <div className="mt-4">
            <CodeBlock language="text" code={GTM_TRIGGERS_TAGS} />
          </div>
        </Card>
      </Section>

      <Section
        title="Step 6 · Map landing pages → Keap tags"
        description="So lead-magnet signups can be attributed to the page that drove them."
        action={<StepStatus ok={step6Ok} label={`${LANDING_PAGE_TAG_MAP.length} mapped`} />}
      >
        <Card>
          <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
            Edit <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-white/10">src/lib/landing-page-tag-map.ts</code>:
            for each landing page that captures emails, tell us which Keap tag those leads get.
            The Landing Pages report uses this to join GA4 visits → Keap tag counts.
          </p>
          <CodeBlock filename="src/lib/landing-page-tag-map.ts" language="ts" code={KEAP_LP_TAG_MAP} />
        </Card>
      </Section>

      <Section
        title="What turns on once this is wired"
        description="Each bullet maps to a sidebar Reports entry."
      >
        <Card>
          <ul className="ml-5 list-disc space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li><strong>Channels</strong> — pivot of utm_source × visits / leads / revenue across the period.</li>
            <li><strong>Landing pages</strong> — for each WP page: visits → cta_click → form_submit → Keap tag → enrollment → revenue.</li>
            <li><strong>Courses</strong> — for each Thinkific course: course_view → begin_checkout → purchase, sliced by the source landing page.</li>
            <li><strong>Emails</strong> — Keap-side metrics joined to enroll_click events that carried the email&apos;s utm_campaign.</li>
            <li><strong>Campaigns</strong> — Keap sequence performance enriched with which landing-page tag the contact entered through.</li>
            <li><strong>Funnels</strong> — predefined cross-channel funnels (free webinar, lower back, blog → newsletter, etc.).</li>
          </ul>
        </Card>
      </Section>
    </main>
  );
}
