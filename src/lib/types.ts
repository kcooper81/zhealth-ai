export interface WPPage {
  id: number;
  title: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string; raw?: string };
  slug: string;
  status: "publish" | "draft" | "pending" | "private" | "trash";
  link: string;
  date: string;
  modified: string;
  template: string;
  parent: number;
  menu_order: number;
  meta?: Record<string, unknown>;
}

export interface WPPost {
  id: number;
  title: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string; raw?: string };
  slug: string;
  status: "publish" | "draft" | "pending" | "private" | "trash";
  link: string;
  date: string;
  modified: string;
  categories: number[];
  tags: number[];
  featured_media: number;
  meta?: Record<string, unknown>;
}

export interface WPMedia {
  id: number;
  title: { rendered: string };
  source_url: string;
  mime_type: string;
  media_details: {
    width: number;
    height: number;
    file: string;
    sizes?: Record<
      string,
      { source_url: string; width: number; height: number }
    >;
  };
  alt_text: string;
  date: string;
}

export interface WPProduct {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  sale_price: string;
  sku: string;
  stock_status: string;
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; alt: string }>;
  permalink: string;
}

export interface WPOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  currency: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    total: string;
  }>;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data?: string;
  url?: string;
  preview?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  files?: FileAttachment[];
  pendingAction?: PendingAction | null;
  actionResult?: ActionResult | null;
  reportData?: ReportData | null;
}

export type Workspace = 'all' | 'website' | 'crm' | 'analytics' | 'lms';

export interface WorkspaceConfig {
  id: Workspace;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  pageContextId?: number;
  workspace: Workspace;
  createdAt: string;
  updatedAt: string;
}

export interface PendingAction {
  id: string;
  type: string;
  params: Record<string, unknown>;
  summary: string;
}

export interface ActionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface SiteInfo {
  name: string;
  description: string;
  url: string;
  home: string;
  gmt_offset: number;
  timezone_string: string;
  namespaces: string[];
}

export interface PageSnapshot {
  pageId: number;
  title: string;
  content: string;
  elementorData?: unknown[];
  meta?: Record<string, unknown>;
  snapshotAt: string;
}

export interface ReportData {
  title: string;
  period: string;
  summary?: Array<{
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
  }>;
  table?: {
    headers: string[];
    rows: Array<Array<string | number>>;
  };
  notes?: string[];
}

export interface StreamChunk {
  type: "token" | "done" | "error";
  text?: string;
  message?: string;
  pendingAction?: PendingAction | null;
  reportData?: ReportData | null;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}
