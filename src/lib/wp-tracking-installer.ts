/**
 * Canonical Z-Health tracking script + WP install/update helpers.
 *
 * Single source of truth for the JavaScript that:
 *   - Bootstraps first-touch UTM/landing context into sessionStorage
 *   - Fires GA4 dataLayer events (cta_click, form_submit, outbound_click, enroll_click)
 *   - Auto-tags outbound courses.zhealtheducation.com / *.thinkific.com links with utm_*
 *
 * The script is installed as an Elementor Pro Custom Code (CPT: elementor_snippet)
 * pushed via the WP REST API. This way, no code lives on the WP filesystem;
 * everything lives here in the repo and is pushed remotely.
 */

const SITE = process.env.WP_SITE_URL || "https://zhealtheducation.com";
const WP_USER = process.env.WP_USERNAME || "";
const WP_PASS = process.env.WP_APP_PASSWORD || "";

export const TRACKING_SNIPPET_TITLE = "Z-Health Unified Tracking";
export const TRACKING_GA4_ID = "G-2BGQW8MGVJ";
export const TRACKING_GTM_ID = "GTM-57LMTDX";

export const TRACKING_CODE = String.raw`<script>
/**
 * Z-Health unified tracking — bootstraps page context, fires custom GA4
 * events for CTA / form / outbound / enroll, and auto-tags outbound
 * Thinkific links with utm_* so attribution survives the domain hop.
 *
 * Owned by /portal/reports/setup. Push updates from there — do not edit
 * inline in WP, your changes will be overwritten on the next push.
 */
(function () {
  if (window.__zh_tracking_loaded) return;
  window.__zh_tracking_loaded = true;
  window.dataLayer = window.dataLayer || [];

  var SS_KEY = 'zh_first_touch';
  var url = new URL(window.location.href);
  var stored;
  try { stored = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null'); } catch (e) { stored = null; }
  if (!stored) {
    stored = {
      utm_source:   url.searchParams.get('utm_source')   || '',
      utm_medium:   url.searchParams.get('utm_medium')   || '',
      utm_campaign: url.searchParams.get('utm_campaign') || '',
      utm_term:     url.searchParams.get('utm_term')     || '',
      utm_content:  url.searchParams.get('utm_content')  || '',
      promo_id:     url.searchParams.get('promo')        || url.searchParams.get('promo_id') || '',
      landing_path: url.pathname,
      landing_title: document.title,
      ts: Date.now()
    };
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(stored)); } catch (e) {}
  }
  var first = stored;

  function pushEvent(name, params) {
    window.dataLayer.push(Object.assign({
      event: name,
      landing_path: first.landing_path || location.pathname,
      utm_source:   first.utm_source   || '',
      utm_medium:   first.utm_medium   || '',
      utm_campaign: first.utm_campaign || '',
      utm_term:     first.utm_term     || '',
      utm_content:  first.utm_content  || '',
      promo_id:     first.promo_id     || ''
    }, params || {}));
  }

  pushEvent('page_context', {
    landing_path: location.pathname,
    landing_title: document.title
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-cta], .elementor-button, a.cta, button.cta, .wc-block-components-button');
    if (!t) return;
    pushEvent('cta_click', {
      cta_id:    t.getAttribute('data-cta') || t.id || '',
      cta_text:  (t.innerText || '').trim().slice(0, 80),
      cta_href:  t.getAttribute('href') || '',
      cta_class: (t.className || '').toString().slice(0, 200)
    });
  }, true);

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    if (a.hostname === location.hostname) return;
    var name = 'outbound_click';
    var extra = { destination_host: a.hostname, destination_url: href };
    if (/courses\.zhealtheducation\.com|\.thinkific\.com/i.test(a.hostname)) {
      name = 'enroll_click';
      var m = href.match(/\/courses\/([^/?#]+)/i);
      if (m) extra.course_slug = m[1];
    }
    pushEvent(name, extra);
  }, true);

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    pushEvent('form_submit', {
      form_id:     f.id || '',
      form_name:   f.getAttribute('name') || '',
      form_action: f.getAttribute('action') || '',
      lead_magnet: f.getAttribute('data-lead-magnet') || ''
    });
  }, true);

  function tagThinkificLinks() {
    var links = document.querySelectorAll('a[href*="courses.zhealtheducation.com"], a[href*=".thinkific.com"]');
    var pageSlug = (location.pathname.replace(/^\/+|\/+$/g, '') || 'home').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    links.forEach(function (a) {
      try {
        var u = new URL(a.href);
        var changed = false;
        var defaults = {
          utm_source: 'zhealtheducation',
          utm_medium: 'website',
          utm_campaign: pageSlug
        };
        Object.keys(defaults).forEach(function (k) {
          if (!u.searchParams.has(k) || u.searchParams.get(k) === '') {
            u.searchParams.set(k, defaults[k]);
            changed = true;
          }
        });
        if (first.promo_id && !u.searchParams.has('promo_id')) {
          u.searchParams.set('promo_id', first.promo_id);
          changed = true;
        }
        if (changed) a.setAttribute('href', u.toString());
      } catch (_) {}
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tagThinkificLinks);
  } else {
    tagThinkificLinks();
  }
  var mo = new MutationObserver(function () { tagThinkificLinks(); });
  mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
</script>`;

function authHeader(): string {
  if (!WP_USER || !WP_PASS) throw new Error("WP credentials not configured");
  return "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
}

async function wpFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SITE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

export type TrackingInstallStatus = {
  installed: boolean;
  snippetId: number | null;
  liveOnSite: boolean;
  /** Last-modified timestamp from WP, if installed */
  modifiedAt: string | null;
  message: string;
};

export async function getTrackingStatus(): Promise<TrackingInstallStatus> {
  try {
    const r = await wpFetch(
      `/wp-json/wp/v2/elementor_snippet?per_page=100&context=edit`,
      { method: "GET" }
    );
    const list = await r.json();
    const existing = Array.isArray(list)
      ? list.find((s: any) => {
          const t = typeof s.title === "object" ? s.title.rendered || s.title.raw : s.title;
          return t === TRACKING_SNIPPET_TITLE;
        })
      : null;

    if (!existing) {
      return {
        installed: false,
        snippetId: null,
        liveOnSite: false,
        modifiedAt: null,
        message: "Not yet installed.",
      };
    }

    // Verify it appears in the live homepage HTML (decoded)
    const liveOnSite = await isSnippetLive();
    return {
      installed: true,
      snippetId: existing.id,
      liveOnSite,
      modifiedAt: existing.modified_gmt || existing.modified || null,
      message: liveOnSite ? "Live on the site." : "Installed but cache may be stale — purge below.",
    };
  } catch (e) {
    return {
      installed: false,
      snippetId: null,
      liveOnSite: false,
      modifiedAt: null,
      message: e instanceof Error ? e.message : "Status check failed",
    };
  }
}

async function isSnippetLive(): Promise<boolean> {
  try {
    const html = await fetch(SITE, { cache: "no-store" }).then((r) => r.text());
    if (html.includes("__zh_tracking_loaded")) return true;
    // Autoptimize may inline as base64; decode and search
    const re = /<script[^>]*src="data:text\/javascript;base64,([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      try {
        const decoded = Buffer.from(m[1], "base64").toString();
        if (decoded.includes("__zh_tracking_loaded")) return true;
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}

export async function installOrUpdateTracking(): Promise<{
  ok: boolean;
  snippetId: number | null;
  cachePurged: boolean;
  liveOnSite: boolean;
  action: "created" | "updated" | "error";
  error?: string;
}> {
  try {
    // 1. Find existing
    const list = await wpFetch(
      `/wp-json/wp/v2/elementor_snippet?per_page=100&context=edit`
    ).then((r) => r.json());
    const existing = Array.isArray(list)
      ? list.find((s: any) => {
          const t = typeof s.title === "object" ? s.title.rendered || s.title.raw : s.title;
          return t === TRACKING_SNIPPET_TITLE;
        })
      : null;

    const payload = {
      title: TRACKING_SNIPPET_TITLE,
      status: "publish",
      meta: {
        _elementor_location: "elementor_head",
        _elementor_priority: 1,
        _elementor_code: TRACKING_CODE,
      },
    };

    let snippetId: number | null = null;
    let action: "created" | "updated" = "created";

    if (existing) {
      action = "updated";
      const upd = await wpFetch(
        `/wp-json/wp/v2/elementor_snippet/${existing.id}?context=edit`,
        { method: "PUT", body: JSON.stringify(payload) }
      );
      if (!upd.ok) {
        const text = await upd.text();
        return {
          ok: false,
          snippetId: existing.id,
          cachePurged: false,
          liveOnSite: false,
          action: "error",
          error: `Update failed (${upd.status}): ${text.slice(0, 200)}`,
        };
      }
      snippetId = existing.id;
    } else {
      const created = await wpFetch(`/wp-json/wp/v2/elementor_snippet?context=edit`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!created.ok) {
        const text = await created.text();
        return {
          ok: false,
          snippetId: null,
          cachePurged: false,
          liveOnSite: false,
          action: "error",
          error: `Create failed (${created.status}): ${text.slice(0, 200)}`,
        };
      }
      const body = await created.json();
      snippetId = body.id;
    }

    // 2. Purge SiteGround dynamic cache so the new snippet renders immediately
    let cachePurged = false;
    try {
      const purge = await wpFetch(`/wp-json/siteground-optimizer/v1/purge-cache`, { method: "PUT" });
      cachePurged = purge.ok;
    } catch {}

    // 3. Verify it shows up in the public HTML (give it a sec)
    await new Promise((r) => setTimeout(r, 1500));
    const liveOnSite = await isSnippetLive();

    return { ok: true, snippetId, cachePurged, liveOnSite, action };
  } catch (e) {
    return {
      ok: false,
      snippetId: null,
      cachePurged: false,
      liveOnSite: false,
      action: "error",
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
