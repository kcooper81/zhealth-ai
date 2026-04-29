/**
 * Keap (Infusionsoft) API Client
 *
 * Uses the Keap REST API v1 with API key authentication.
 * Docs: https://developer.keap.com/docs/restv1/
 */

const API_BASE = "https://api.infusionsoft.com/crm/rest/v1";

function getApiKey(): string {
  const key = process.env.KEAP_API_KEY;
  if (!key) throw new Error("KEAP_API_KEY not configured");
  return key;
}

function headers(): Record<string, string> {
  const key = getApiKey();
  return {
    "X-Keap-API-Key": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function keapFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });

  if (!response.ok) {
    let msg: string;
    try {
      const err = await response.json();
      msg = err.message || err.fault?.faultstring || response.statusText;
    } catch {
      msg = response.statusText;
    }
    throw new Error(`Keap API error (${response.status}): ${msg}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ---- Contacts ----

export interface KeapContact {
  id: number;
  email_addresses?: Array<{ email: string; field: string }>;
  given_name?: string;
  family_name?: string;
  phone_numbers?: Array<{ number: string; field: string }>;
  tag_ids?: number[];
  date_created?: string;
  last_updated?: string;
  owner_id?: number;
  custom_fields?: Array<{ id: number; content: any }>;
}

export async function listContacts(params?: {
  limit?: number;
  offset?: number;
  email?: string;
  given_name?: string;
  family_name?: string;
  order?: string;
  order_direction?: "ASCENDING" | "DESCENDING";
  since?: string;
  until?: string;
}): Promise<{ contacts: KeapContact[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.email) qs.set("email", params.email);
  if (params?.given_name) qs.set("given_name", params.given_name);
  if (params?.family_name) qs.set("family_name", params.family_name);
  if (params?.order) qs.set("order", params.order);
  if (params?.order_direction) qs.set("order_direction", params.order_direction);
  if (params?.since) qs.set("since", params.since);
  if (params?.until) qs.set("until", params.until);

  const data = await keapFetch(`/contacts?${qs}`);
  return { contacts: data.contacts || [], count: data.count || 0 };
}

export async function getContact(contactId: number): Promise<KeapContact> {
  return keapFetch(`/contacts/${contactId}`);
}

export async function createContact(data: {
  email_addresses?: Array<{ email: string; field: string }>;
  given_name?: string;
  family_name?: string;
  phone_numbers?: Array<{ number: string; field: string }>;
}): Promise<KeapContact> {
  return keapFetch("/contacts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateContact(
  contactId: number,
  data: Partial<KeapContact>
): Promise<KeapContact> {
  return keapFetch(`/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteContact(contactId: number): Promise<void> {
  await keapFetch(`/contacts/${contactId}`, { method: "DELETE" });
}

// ---- Tags ----

export interface KeapTag {
  id: number;
  name: string;
  description?: string;
  category?: { id: number; name: string };
}

export async function listTags(params?: {
  limit?: number;
  offset?: number;
  name?: string;
  category?: number;
}): Promise<{ tags: KeapTag[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.name) qs.set("name", params.name);
  if (params?.category) qs.set("category", String(params.category));

  const data = await keapFetch(`/tags?${qs}`);
  return { tags: data.tags || [], count: data.count || 0 };
}

export async function createTag(data: {
  name: string;
  description?: string;
  category?: { id: number };
}): Promise<KeapTag> {
  return keapFetch("/tags", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function applyTagToContacts(
  tagId: number,
  contactIds: number[]
): Promise<void> {
  await keapFetch(`/tags/${tagId}/contacts`, {
    method: "POST",
    body: JSON.stringify({ ids: contactIds }),
  });
}

export async function removeTagFromContacts(
  tagId: number,
  contactIds: number[]
): Promise<void> {
  // Keap API removes tags one at a time
  for (const id of contactIds) {
    await keapFetch(`/tags/${tagId}/contacts/${id}`, { method: "DELETE" });
  }
}

/**
 * Fetch all tags (up to `max`) with their contact counts in parallel.
 * Used by the Course Registration report to rank tags by membership.
 *
 * Each per-tag call returns {count} via getContactsWithTag(tagId, { limit: 1 }).
 */
export async function getTagsWithCounts(max = 200): Promise<
  Array<KeapTag & { contactCount: number }>
> {
  const list = await listTags({ limit: max });
  const withCounts = await Promise.all(
    list.tags.map(async (t) => {
      try {
        const result = await getContactsWithTag(t.id, { limit: 1 });
        return { ...t, contactCount: result.count };
      } catch {
        return { ...t, contactCount: 0 };
      }
    })
  );
  // Default sort: most contacts first
  return withCounts.sort((a, b) => b.contactCount - a.contactCount);
}

export async function getContactsWithTag(
  tagId: number,
  params?: { limit?: number; offset?: number }
): Promise<{ contacts: KeapContact[]; count: number }> {
  const qs = new URLSearchParams();
  qs.set("tag_id", String(tagId));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));

  const data = await keapFetch(`/contacts?${qs}`);
  return { contacts: data.contacts || [], count: data.count || 0 };
}

// ---- Campaigns / Email ----

export interface KeapCampaign {
  id: number;
  name: string;
  goals?: Array<{ id: number; name: string; type: string }>;
  published_date?: string;
  active_contact_count?: number;
}

export async function listCampaigns(params?: {
  limit?: number;
  offset?: number;
  search_text?: string;
}): Promise<{ campaigns: KeapCampaign[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.search_text) qs.set("search_text", params.search_text);

  const data = await keapFetch(`/campaigns?${qs}`);
  return { campaigns: data.campaigns || [], count: data.count || 0 };
}

export async function addContactToCampaignSequence(
  campaignId: number,
  sequenceId: number,
  contactId: number
): Promise<void> {
  await keapFetch(
    `/campaigns/${campaignId}/sequences/${sequenceId}/contacts/${contactId}`,
    { method: "POST" }
  );
}

// ---- Opportunities (Pipeline) ----

export interface KeapOpportunity {
  id: number;
  opportunity_title: string;
  contact?: { id: number; first_name: string; last_name: string };
  stage?: { name: string; id: number };
  estimated_close_date?: string;
  projected_revenue_high?: number;
  projected_revenue_low?: number;
}

export async function listOpportunities(params?: {
  limit?: number;
  offset?: number;
  stage_id?: number;
  search_term?: string;
  order?: string;
}): Promise<{ opportunities: KeapOpportunity[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.stage_id) qs.set("stage_id", String(params.stage_id));
  if (params?.search_term) qs.set("search_term", params.search_term);
  if (params?.order) qs.set("order", params.order);

  const data = await keapFetch(`/opportunities?${qs}`);
  return { opportunities: data.opportunities || [], count: data.count || 0 };
}

export async function createOpportunity(data: {
  opportunity_title: string;
  contact: { id: number };
  stage?: { id: number };
  projected_revenue_high?: number;
  estimated_close_date?: string;
}): Promise<KeapOpportunity> {
  return keapFetch("/opportunities", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOpportunityStage(
  opportunityId: number,
  stageId: number
): Promise<KeapOpportunity> {
  return keapFetch(`/opportunities/${opportunityId}`, {
    method: "PATCH",
    body: JSON.stringify({ stage: { id: stageId } }),
  });
}

// ---- Pipeline Stages ----

export async function listPipelineStages(): Promise<
  Array<{ id: number; name: string; stage_order: number }>
> {
  const data = await keapFetch("/opportunity/stage_pipeline");
  return data || [];
}

// ---- Orders / Transactions ----

export interface KeapOrder {
  id: number;
  title: string;
  contact: { id: number; first_name: string; last_name: string; email: string };
  order_date: string;
  total: number;
  status: string;
  order_items?: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
  }>;
}

export async function listOrders(params?: {
  limit?: number;
  offset?: number;
  contact_id?: number;
  since?: string;
  until?: string;
}): Promise<{ orders: KeapOrder[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.contact_id) qs.set("contact_id", String(params.contact_id));
  if (params?.since) qs.set("since", params.since);
  if (params?.until) qs.set("until", params.until);

  const data = await keapFetch(`/orders?${qs}`);
  return { orders: data.orders || [], count: data.count || 0 };
}

// ---- Emails ----

export interface KeapEmail {
  id: number;
  subject: string;
  sent_to_address?: string;
  sent_from_address?: string;
  sent_date?: string;
  received_date?: string;
  contact_id?: number;
  headers?: string;
  // Note: Keap REST API v1 does NOT expose email open/click tracking.
  // Open and click data is only available in the Keap admin UI.
}

export async function listEmails(params?: {
  limit?: number;
  offset?: number;
  contact_id?: number;
  email?: string;
  since_sent_date?: string;
}): Promise<{ emails: KeapEmail[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.contact_id) qs.set("contact_id", String(params.contact_id));
  if (params?.email) qs.set("email", params.email);
  if (params?.since_sent_date) qs.set("since_sent_date", params.since_sent_date);

  const data = await keapFetch(`/emails?${qs}`);
  return { emails: data.emails || [], count: data.count || 0 };
}

export async function getEmail(emailId: number): Promise<KeapEmail> {
  return keapFetch(`/emails/${emailId}`);
}

export async function getContactEmailOptStatus(contactId: number): Promise<{
  opted_in: boolean;
  opt_in_reason?: string;
  opt_in_date?: string;
}> {
  try {
    const data = await keapFetch(`/contacts/${contactId}?optional_properties=opt_in_reason`);
    return {
      opted_in: data.email_opted_in ?? true,
      opt_in_reason: data.opt_in_reason || "",
      opt_in_date: data.date_created || "",
    };
  } catch {
    return { opted_in: false };
  }
}

export async function sendEmail(data: {
  contacts: number[];
  subject: string;
  html_content: string;
  user_id?: number;
}): Promise<void> {
  await keapFetch("/emails/queue", {
    method: "POST",
    body: JSON.stringify({
      contacts: data.contacts.map((id) => ({ id })),
      subject: data.subject,
      html_content: data.html_content,
      ...(data.user_id ? { user_id: data.user_id } : {}),
    }),
  });
}

// ---- Account Info ----

export async function getAccountInfo(): Promise<{
  name: string;
  email: string;
  phone?: string;
  phone_ext?: string;
  address?: any;
  website?: string;
  time_zone?: string;
  logo_url?: string;
}> {
  return keapFetch("/account/profile");
}

// ---- Keap capabilities for AI context ----

export function getKeapCapabilities(): string[] {
  return [
    "List, search, create, and update contacts",
    "Apply and remove tags from contacts",
    "List contacts with a specific tag",
    "View and manage campaigns",
    "Add contacts to campaign sequences",
    "View and manage pipeline opportunities",
    "Move opportunities between pipeline stages",
    "View orders and transactions",
    "List sent emails (subjects, dates, recipients)",
    "View individual email details",
    "Check contact email opt-in status",
    "Send emails to contacts",
    "View account information",
  ];
}

export function getKeapContext(): string {
  return `
## Keap CRM Integration
You can manage the Keap (Infusionsoft) CRM system. Available actions:
- **Contacts**: Search, create, update, and delete contacts. View contact details including tags, emails, and phone numbers.
- **Tags**: List tags, create new tags, apply tags to contacts, remove tags from contacts, find all contacts with a specific tag.
- **Campaigns**: List campaigns, add contacts to campaign sequences for automated email workflows.
- **Pipeline**: View opportunities in the sales pipeline, create new opportunities, move them between stages.
- **Orders**: View order history, filter by contact or date range.
- **Email**: List sent emails (subject, dates, recipients), check contact opt-in status, send emails to contacts. Note: open/click tracking is NOT available via the Keap API — it's only in the Keap admin UI.

When the user asks about contacts, tags, campaigns, pipeline, orders, revenue, or CRM tasks, use the Keap integration.
Action types for Keap:
- keap_list_contacts, keap_get_contact, keap_create_contact, keap_update_contact
- keap_apply_tag, keap_remove_tag, keap_list_tags, keap_create_tag
- keap_list_campaigns, keap_add_to_campaign
- keap_list_opportunities, keap_create_opportunity, keap_update_opportunity_stage
- keap_list_orders
- keap_list_emails, keap_get_email, keap_get_email_opt_status
- keap_send_email

You can generate reports on ANY Keap data. When the user asks for a Keap report, pull the data using the appropriate action above, then format it as a <report> block. Available report types you can generate:
- Contact reports: all contacts, contacts by tag, new contacts in a date range, contacts without tags
- Tag reports: all tags, tag breakdown by category, contacts per tag
- Revenue reports: orders by date range, revenue by product, revenue by contact, average order value trends
- Pipeline reports: opportunities by stage, projected revenue, estimated close dates, stage conversion
- Campaign reports: all campaigns, active contacts per campaign, campaign performance
- Order detail reports: line-item breakdowns, product sales, per-contact order history
- Email reports: emails sent in date range, send volume by subject, per-contact email history, opt-in status. Note: open/click rates are NOT available via API — direct the user to the Keap admin dashboard for engagement metrics.
Always use the <report> tag format so the data renders as a rich card with downloadable CSV and PDF.
`;
}

export function isConfigured(): boolean {
  return !!process.env.KEAP_API_KEY;
}
