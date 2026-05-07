/**
 * Tracking Setup — copy-paste snippets that wire WP + Thinkific + Keap
 * into the GA4 properties this portal reads. Once these are in place,
 * the Channels / Landing Pages / Courses / Emails / Funnels reports
 * have data to pivot.
 */
import Section, { Card } from "@/components/portal/Section";
import CodeBlock from "@/components/portal/CodeBlock";

export const metadata = { title: "Tracking Setup — Z-Health Portal" };

const GA4_WEBSITE = "G-2BGQW8MGVJ";
// Thinkific GA4 ID — populate on the Thinkific site if not already set.
// We mirror the website ID so cross-domain user_id matching works.
const GA4_LMS_NOTE = "Use the same G-2BGQW8MGVJ on Thinkific so a single user is one user across both domains. (You can keep a separate property for the LMS if you also need it; this just adds a second tag.)";

const WP_GTM_HEAD = `<!-- Google Tag Manager — already on the site (GTM-57LMTDX) -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-57LMTDX');</script>`;

const WP_DATALAYER_BOOTSTRAP = `<script>
// Bootstrap dataLayer with page context Keap + GA4 can use.
window.dataLayer = window.dataLayer || [];

(function () {
  var url = new URL(window.location.href);
  var landingPath = url.pathname;
  var landingTitle = document.title;

  // Persist first-touch source for the session
  var SS_KEY = 'zh_first_touch';
  var stored = sessionStorage.getItem(SS_KEY);
  if (!stored) {
    stored = JSON.stringify({
      utm_source:   url.searchParams.get('utm_source')   || '',
      utm_medium:   url.searchParams.get('utm_medium')   || '',
      utm_campaign: url.searchParams.get('utm_campaign') || '',
      utm_term:     url.searchParams.get('utm_term')     || '',
      utm_content:  url.searchParams.get('utm_content')  || '',
      promo_id:     url.searchParams.get('promo')        || url.searchParams.get('promo_id') || '',
      landing_path: landingPath,
      landing_title: landingTitle,
      ts: Date.now()
    });
    sessionStorage.setItem(SS_KEY, stored);
  }
  var first = JSON.parse(stored);

  window.dataLayer.push({
    event: 'page_context',
    landing_path: landingPath,
    landing_title: landingTitle,
    utm_source:   first.utm_source,
    utm_medium:   first.utm_medium,
    utm_campaign: first.utm_campaign,
    utm_term:     first.utm_term,
    utm_content:  first.utm_content,
    promo_id:     first.promo_id
  });
})();
</script>`;

const WP_EVENT_DELEGATION = `<script>
// Event delegation — fires GA4 events for CTA clicks, form submits,
// outbound links, and Thinkific enroll links. Add this once site-wide.
window.dataLayer = window.dataLayer || [];

(function () {
  function pushEvent(name, params) {
    var first = {};
    try { first = JSON.parse(sessionStorage.getItem('zh_first_touch') || '{}'); } catch(e){}
    window.dataLayer.push(Object.assign({
      event: name,
      landing_path: first.landing_path || location.pathname,
      utm_source: first.utm_source || '',
      utm_medium: first.utm_medium || '',
      utm_campaign: first.utm_campaign || '',
      promo_id: first.promo_id || ''
    }, params || {}));
  }

  // 1. Any element with [data-cta] or .cta button → cta_click
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-cta], .elementor-button, a.cta, button.cta');
    if (!t) return;
    pushEvent('cta_click', {
      cta_id:    t.getAttribute('data-cta') || t.id || '',
      cta_text:  (t.innerText || '').trim().slice(0, 80),
      cta_href:  t.getAttribute('href') || '',
      cta_class: t.className || ''
    });
  }, true);

  // 2. Outbound link → outbound_click (and a higher-signal enroll_click
  // for links to courses.zhealtheducation.com or thinkific.com)
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var isAbs = /^https?:\\/\\//i.test(href);
    if (!isAbs) return;
    var sameHost = a.hostname === location.hostname;
    if (sameHost) return;
    var name = 'outbound_click';
    var extra = { destination_host: a.hostname, destination_url: href };
    if (/courses\\.zhealtheducation\\.com|\\.thinkific\\.com/i.test(a.hostname)) {
      name = 'enroll_click';
      // Try to read course slug from /courses/<slug> or /enrollments/<id>
      var m = href.match(/\\/courses\\/([^/?#]+)/i);
      if (m) extra.course_slug = m[1];
    }
    pushEvent(name, extra);
  }, true);

  // 3. Form submit → form_submit (with form id + lead_magnet hint)
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    pushEvent('form_submit', {
      form_id:   f.id || '',
      form_name: f.getAttribute('name') || '',
      form_action: f.getAttribute('action') || '',
      lead_magnet: f.getAttribute('data-lead-magnet') || ''
    });
  }, true);
})();
</script>`;

const WP_PHP_PLUGIN = `<?php
/**
 * Plugin Name: Z-Health Tracking Helpers
 * Description: Auto-attaches UTM parameters to outbound links pointing at
 *              courses.zhealtheducation.com so cross-domain attribution
 *              survives WordPress → Thinkific. Also injects the dataLayer
 *              bootstrap + event delegation in <head>.
 * Version: 1.0
 *
 * Drop into wp-content/mu-plugins/ (auto-loads, no activation needed)
 * or upload as a regular plugin and activate.
 */

if (!defined('ABSPATH')) exit;

// 1. Inject the dataLayer bootstrap + event delegation in <head>
add_action('wp_head', function () {
  // Pull values from the currently-rendered post for richer events.
  $post_id = get_the_ID();
  $post_type = $post_id ? get_post_type($post_id) : '';
  $promo_id = $post_id ? (string) get_post_meta($post_id, 'zh_promo_id', true) : '';
  ?>
  <script>
    window.zhPageContext = {
      page_id: <?php echo $post_id ? (int) $post_id : 'null'; ?>,
      page_type: <?php echo wp_json_encode($post_type); ?>,
      promo_id: <?php echo wp_json_encode($promo_id); ?>
    };
  </script>
  <?php
}, 1);

// 2. Auto-tag outbound Thinkific links with utm_* params so each LP is
// attributable on the Thinkific side. Keeps any existing utm_* on the link.
add_filter('the_content', function ($content) {
  if (is_admin() || empty($content)) return $content;

  return preg_replace_callback(
    '/<a\\s+([^>]*?)href=([\"\\\'])((https?:)?\\/\\/(courses\\.zhealtheducation\\.com|[a-z0-9.-]+\\.thinkific\\.com)[^\"\\\']*)\\2([^>]*)>/i',
    function ($m) {
      $pre = $m[1];
      $q   = $m[2];
      $url = $m[3];
      $post= $m[6];

      $parts = wp_parse_url($url);
      parse_str($parts['query'] ?? '', $qs);

      // Only set if not already specified on the link
      $defaults = [
        'utm_source'   => 'zhealtheducation',
        'utm_medium'   => 'website',
        'utm_campaign' => sanitize_title(get_the_title() ?: 'site'),
        'utm_content'  => 'inline-link'
      ];
      foreach ($defaults as $k => $v) {
        if (!isset($qs[$k]) || $qs[$k] === '') $qs[$k] = $v;
      }

      $newQuery = http_build_query($qs);
      $rebuilt =
        (isset($parts['scheme']) ? $parts['scheme'] . ':' : '') .
        '//' . $parts['host'] .
        ($parts['path'] ?? '') .
        '?' . $newQuery .
        (isset($parts['fragment']) ? '#' . $parts['fragment'] : '');

      return '<a ' . $pre . 'href=' . $q . esc_url($rebuilt) . $q . $post . '>';
    },
    $content
  );
}, 50);
`;

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

export default function TrackingSetupPage() {
  return (
    <main className="mx-auto max-w-5xl px-8 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          Tracking Setup
        </h1>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          One-time wiring that powers every report under <strong>Reports</strong>.
          Once these snippets are in place, GA4 collects the events the portal pivots on,
          and every WordPress → Thinkific link carries UTM context end-to-end.
        </p>
      </header>

      <Section title="Step 1 · Confirm GA4 IDs" description="Identifiers used across the stack.">
        <Card>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Website measurement ID</dt>
              <dd className="mt-1 font-mono text-base text-gray-900 dark:text-gray-100">{GA4_WEBSITE}</dd>
              <dd className="text-xs text-gray-500">currently active on zhealtheducation.com</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">GTM container</dt>
              <dd className="mt-1 font-mono text-base text-gray-900 dark:text-gray-100">GTM-57LMTDX</dd>
              <dd className="text-xs text-gray-500">manage events here</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>Thinkific note:</strong> {GA4_LMS_NOTE}
          </p>
        </Card>
      </Section>

      <Section
        title="Step 2 · Push events into the dataLayer (WordPress)"
        description="Two scripts in <head>. The first builds session context (UTM, landing path); the second wires CTA clicks, form submits, and outbound enrollment links."
      >
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Bootstrap (paste in &lt;head&gt;)</h3>
            <CodeBlock language="html" code={WP_DATALAYER_BOOTSTRAP} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Event delegation (paste below the bootstrap)</h3>
            <CodeBlock language="html" code={WP_EVENT_DELEGATION} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              GTM is already loaded site-wide — for reference
            </h3>
            <CodeBlock language="html" code={WP_GTM_HEAD} />
          </div>
        </div>
      </Section>

      <Section
        title="Step 3 · Auto-tag outbound Thinkific links (WP plugin)"
        description="Drop into wp-content/mu-plugins/ (auto-loads). Rewrites every WordPress link pointing at courses.zhealtheducation.com or *.thinkific.com to carry utm_source / utm_medium / utm_campaign so attribution survives the domain hop."
      >
        <CodeBlock filename="wp-content/mu-plugins/zh-tracking.php" language="php" code={WP_PHP_PLUGIN} />
      </Section>

      <Section
        title="Step 4 · Thinkific code injection"
        description="Paste into Thinkific → Settings → Code & Analytics → Site Footer Code. Receives the UTM context from the auto-tagged WP links and emits course_view, begin_checkout, sign_up_view, and purchase events into the same GA4 property as the website."
      >
        <CodeBlock language="html" code={THINKIFIC_HEAD} />
      </Section>

      <Section
        title="Step 5 · GTM configuration (one-time)"
        description="Map dataLayer keys → GA4 event params. Once this is set, every event auto-carries cta / form / utm / promo / course context."
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
