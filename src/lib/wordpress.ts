import type {
  WPPage,
  WPPost,
  WPPopup,
  WPMedia,
  WPProduct,
  WPOrder,
  SiteInfo,
} from "./types";

class WordPressClient {
  private siteUrl: string;
  private username: string;
  private appPassword: string;
  private wcConsumerKey: string;
  private wcConsumerSecret: string;

  constructor() {
    this.siteUrl = process.env.WP_SITE_URL || "";
    this.username = process.env.WP_USERNAME || "";
    this.appPassword = process.env.WP_APP_PASSWORD || "";
    this.wcConsumerKey = process.env.WC_CONSUMER_KEY || "";
    this.wcConsumerSecret = process.env.WC_CONSUMER_SECRET || "";

    if (!this.siteUrl) {
      throw new Error("WP_SITE_URL environment variable is required");
    }
  }

  private get authHeader(): string {
    const credentials = Buffer.from(
      `${this.username}:${this.appPassword}`
    ).toString("base64");
    return `Basic ${credentials}`;
  }

  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(path, this.siteUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      params?: Record<string, unknown>;
      body?: unknown;
      headers?: Record<string, string>;
      useWcAuth?: boolean;
    } = {}
  ): Promise<T> {
    const {
      method = "GET",
      params,
      body,
      headers = {},
      useWcAuth = false,
    } = options;

    let url: string;
    if (useWcAuth) {
      const wcParams = {
        ...params,
        consumer_key: this.wcConsumerKey,
        consumer_secret: this.wcConsumerSecret,
      };
      url = this.buildUrl(path, wcParams);
    } else {
      url = this.buildUrl(path, params);
    }

    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    if (!useWcAuth) {
      requestHeaders["Authorization"] = this.authHeader;
    }

    if (body && !(body instanceof FormData)) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body) {
      fetchOptions.body =
        body instanceof FormData ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorBody = await response.json();
        errorMessage =
          errorBody.message || errorBody.error || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      throw new Error(
        `WordPress API error (${response.status}): ${errorMessage} [${method} ${path}]`
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------

  async listPages(
    params?: {
      search?: string;
      status?: string;
      per_page?: number;
      page?: number;
    }
  ): Promise<WPPage[]> {
    return this.request<WPPage[]>("/wp-json/wp/v2/pages", { params });
  }

  async getPage(
    id: number,
    context: "view" | "edit" = "view"
  ): Promise<WPPage> {
    return this.request<WPPage>(`/wp-json/wp/v2/pages/${id}`, {
      params: { context },
    });
  }

  async createPage(data: {
    title: string;
    content?: string;
    status?: string;
    slug?: string;
    template?: string;
  }): Promise<WPPage> {
    return this.request<WPPage>("/wp-json/wp/v2/pages", {
      method: "POST",
      body: data,
    });
  }

  async updatePage(
    id: number,
    data: Partial<{
      title: string;
      content: string;
      status: string;
      slug: string;
      template: string;
      meta: Record<string, unknown>;
    }>
  ): Promise<WPPage> {
    return this.request<WPPage>(`/wp-json/wp/v2/pages/${id}`, {
      method: "POST",
      body: data,
    });
  }

  async deletePage(id: number, force = false): Promise<WPPage> {
    return this.request<WPPage>(`/wp-json/wp/v2/pages/${id}`, {
      method: "DELETE",
      params: { force },
    });
  }

  // ---------------------------------------------------------------------------
  // Posts
  // ---------------------------------------------------------------------------

  async listPosts(
    params?: {
      search?: string;
      status?: string;
      per_page?: number;
      page?: number;
      categories?: string;
      tags?: string;
    }
  ): Promise<WPPost[]> {
    return this.request<WPPost[]>("/wp-json/wp/v2/posts", { params });
  }

  async getPost(
    id: number,
    context: "view" | "edit" = "view"
  ): Promise<WPPost> {
    return this.request<WPPost>(`/wp-json/wp/v2/posts/${id}`, {
      params: { context },
    });
  }

  async createPost(data: {
    title: string;
    content?: string;
    status?: string;
    slug?: string;
    categories?: number[];
    tags?: number[];
    featured_media?: number;
  }): Promise<WPPost> {
    return this.request<WPPost>("/wp-json/wp/v2/posts", {
      method: "POST",
      body: data,
    });
  }

  async updatePost(
    id: number,
    data: Partial<{
      title: string;
      content: string;
      status: string;
      slug: string;
      categories: number[];
      tags: number[];
      featured_media: number;
      meta: Record<string, unknown>;
    }>
  ): Promise<WPPost> {
    return this.request<WPPost>(`/wp-json/wp/v2/posts/${id}`, {
      method: "POST",
      body: data,
    });
  }

  async deletePost(id: number, force = false): Promise<WPPost> {
    return this.request<WPPost>(`/wp-json/wp/v2/posts/${id}`, {
      method: "DELETE",
      params: { force },
    });
  }

  // ---------------------------------------------------------------------------
  // Media
  // ---------------------------------------------------------------------------

  async listMedia(
    params?: {
      search?: string;
      per_page?: number;
      page?: number;
      mime_type?: string;
    }
  ): Promise<WPMedia[]> {
    return this.request<WPMedia[]>("/wp-json/wp/v2/media", { params });
  }

  async getMedia(id: number): Promise<WPMedia> {
    return this.request<WPMedia>(`/wp-json/wp/v2/media/${id}`);
  }

  async uploadMedia(
    file: Buffer,
    filename: string,
    mimeType: string
  ): Promise<WPMedia> {
    const url = this.buildUrl("/wp-json/wp/v2/media");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": mimeType,
      },
      body: new Uint8Array(file),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      throw new Error(
        `Media upload failed (${response.status}): ${errorMessage}`
      );
    }

    return response.json();
  }

  async deleteMedia(id: number): Promise<void> {
    await this.request<unknown>(`/wp-json/wp/v2/media/${id}`, {
      method: "DELETE",
      params: { force: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Elementor Popups (elementor_library post type)
  // ---------------------------------------------------------------------------

  async listPopups(
    params?: {
      search?: string;
      status?: string;
      per_page?: number;
      page?: number;
    }
  ): Promise<WPPopup[]> {
    return this.request<WPPopup[]>("/wp-json/wp/v2/elementor_library", {
      params: { ...params, type: "popup" },
    });
  }

  async getPopup(
    id: number,
    context: "view" | "edit" = "view"
  ): Promise<WPPopup> {
    return this.request<WPPopup>(`/wp-json/wp/v2/elementor_library/${id}`, {
      params: { context },
    });
  }

  async createPopup(data: {
    title: string;
    content?: string;
    status?: string;
    meta?: Record<string, unknown>;
  }): Promise<WPPopup> {
    return this.request<WPPopup>("/wp-json/wp/v2/elementor_library", {
      method: "POST",
      body: {
        ...data,
        status: data.status || "draft",
        meta: {
          _elementor_template_type: "popup",
          _elementor_edit_mode: "builder",
          ...data.meta,
        },
      },
    });
  }

  async updatePopup(
    id: number,
    data: Partial<{
      title: string;
      content: string;
      status: string;
      meta: Record<string, unknown>;
    }>
  ): Promise<WPPopup> {
    return this.request<WPPopup>(`/wp-json/wp/v2/elementor_library/${id}`, {
      method: "POST",
      body: data,
    });
  }

  async deletePopup(id: number, force = false): Promise<WPPopup> {
    return this.request<WPPopup>(`/wp-json/wp/v2/elementor_library/${id}`, {
      method: "DELETE",
      params: { force },
    });
  }

  async getPopupDisplayConditions(
    popupId: number
  ): Promise<Record<string, unknown> | null> {
    const popup = await this.getPopup(popupId, "edit");
    const meta = popup.meta as Record<string, unknown> | undefined;
    if (!meta) return null;
    return {
      conditions: meta._elementor_conditions || [],
      triggers: meta._elementor_popup_triggers || {},
      timing: meta._elementor_popup_timing || {},
    };
  }

  async updatePopupDisplayConditions(
    popupId: number,
    settings: {
      conditions?: unknown[];
      triggers?: Record<string, unknown>;
      timing?: Record<string, unknown>;
    }
  ): Promise<WPPopup> {
    const meta: Record<string, unknown> = {};
    if (settings.conditions !== undefined) {
      meta._elementor_conditions = settings.conditions;
    }
    if (settings.triggers !== undefined) {
      meta._elementor_popup_triggers = settings.triggers;
    }
    if (settings.timing !== undefined) {
      meta._elementor_popup_timing = settings.timing;
    }
    return this.updatePopup(popupId, { meta });
  }

  async getPopupElementorData(popupId: number): Promise<unknown[] | null> {
    const popup = await this.getPopup(popupId, "edit");
    const meta = popup.meta as Record<string, unknown> | undefined;
    if (!meta || !meta._elementor_data) return null;
    const data = meta._elementor_data;
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return Array.isArray(data) ? data : null;
  }

  async updatePopupElementorData(
    popupId: number,
    data: unknown[]
  ): Promise<WPPopup> {
    return this.updatePopup(popupId, {
      meta: {
        _elementor_data: JSON.stringify(data),
        _elementor_edit_mode: "builder",
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Elementor
  // ---------------------------------------------------------------------------

  async getElementorData(pageId: number): Promise<unknown[] | null> {
    const page = await this.getPage(pageId, "edit");
    const meta = page.meta as Record<string, unknown> | undefined;
    if (!meta || !meta._elementor_data) {
      return null;
    }
    const data = meta._elementor_data;
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return Array.isArray(data) ? data : null;
  }

  async updateElementorData(
    pageId: number,
    data: unknown[]
  ): Promise<WPPage> {
    return this.updatePage(pageId, {
      meta: {
        _elementor_data: JSON.stringify(data),
        _elementor_edit_mode: "builder",
      },
    });
  }

  async getElementorPageSettings(
    pageId: number
  ): Promise<Record<string, unknown> | null> {
    const page = await this.getPage(pageId, "edit");
    const meta = page.meta as Record<string, unknown> | undefined;
    if (!meta || !meta._elementor_page_settings) {
      return null;
    }
    const settings = meta._elementor_page_settings;
    if (typeof settings === "string") {
      try {
        return JSON.parse(settings);
      } catch {
        return null;
      }
    }
    return typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>)
      : null;
  }

  // ---------------------------------------------------------------------------
  // SEO (Yoast)
  // ---------------------------------------------------------------------------

  async getSeoMeta(
    postId: number
  ): Promise<{
    title: string;
    description: string;
    focusKeyword: string;
  } | null> {
    const post = await this.request<Record<string, unknown>>(
      `/wp-json/wp/v2/posts/${postId}`,
      { params: { context: "edit" } }
    );
    const yoast = post.yoast_head_json as Record<string, string> | undefined;
    if (!yoast) {
      return null;
    }
    return {
      title: yoast.title || "",
      description: yoast.og_description || yoast.description || "",
      focusKeyword: "",
    };
  }

  async updateSeoMeta(
    postId: number,
    data: {
      title?: string;
      description?: string;
      focusKeyword?: string;
    }
  ): Promise<unknown> {
    const meta: Record<string, string> = {};
    if (data.title !== undefined) {
      meta._yoast_wpseo_title = data.title;
    }
    if (data.description !== undefined) {
      meta._yoast_wpseo_metadesc = data.description;
    }
    if (data.focusKeyword !== undefined) {
      meta._yoast_wpseo_focuskw = data.focusKeyword;
    }
    return this.request(`/wp-json/wp/v2/posts/${postId}`, {
      method: "POST",
      body: { meta },
    });
  }

  // ---------------------------------------------------------------------------
  // WooCommerce
  // ---------------------------------------------------------------------------

  async listProducts(
    params?: {
      search?: string;
      per_page?: number;
      page?: number;
      status?: string;
      category?: number;
    }
  ): Promise<WPProduct[]> {
    return this.request<WPProduct[]>("/wp-json/wc/v3/products", {
      params,
      useWcAuth: true,
    });
  }

  async getProduct(id: number): Promise<WPProduct> {
    return this.request<WPProduct>(`/wp-json/wc/v3/products/${id}`, {
      useWcAuth: true,
    });
  }

  async updateProduct(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      short_description: string;
      regular_price: string;
      sale_price: string;
      status: string;
      sku: string;
    }>
  ): Promise<WPProduct> {
    return this.request<WPProduct>(`/wp-json/wc/v3/products/${id}`, {
      method: "POST",
      body: data,
      useWcAuth: true,
    });
  }

  async getOrders(
    params?: {
      per_page?: number;
      page?: number;
      status?: string;
      after?: string;
      before?: string;
    }
  ): Promise<WPOrder[]> {
    return this.request<WPOrder[]>("/wp-json/wc/v3/orders", {
      params,
      useWcAuth: true,
    });
  }

  // ---------------------------------------------------------------------------
  // General
  // ---------------------------------------------------------------------------

  async getSiteInfo(): Promise<SiteInfo> {
    return this.request<SiteInfo>("/wp-json/");
  }

  async getPostTypes(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/wp-json/wp/v2/types");
  }
}

let clientInstance: WordPressClient | null = null;

export function getWordPressClient(): WordPressClient {
  if (!clientInstance) {
    clientInstance = new WordPressClient();
  }
  return clientInstance;
}

export default WordPressClient;
