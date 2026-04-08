import { promises as fs } from "fs";
import path from "path";

// --- Types ---

export interface WorkflowStep {
  id: string;
  type: string;
  label: string;
  description: string;
  config: Record<string, any>;
  usesAI: boolean;
  prompt?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: string;
  steps: WorkflowStep[];
  createdAt: string;
  lastRunAt?: string;
  runCount: number;
  isTemplate?: boolean;
}

export interface WorkflowRunStepResult {
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: any;
  error?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed" | "paused";
  currentStep: number;
  results: WorkflowRunStepResult[];
  startedAt: string;
  completedAt?: string;
}

export interface StepTypeDefinition {
  type: string;
  label: string;
  description: string;
  icon: string;
  configSchema: Record<string, { type: string; label: string; required?: boolean; placeholder?: string }>;
}

// --- Available step types ---

export function getAvailableSteps(): StepTypeDefinition[] {
  return [
    {
      type: "create_page",
      label: "Create Page",
      description: "Create a new WordPress page with AI-generated content",
      icon: "Document",
      configSchema: {
        title: { type: "text", label: "Page Title", required: true, placeholder: "e.g. {{topic}} Landing Page" },
        slug: { type: "text", label: "Slug (optional)", placeholder: "auto-generated-from-title" },
        template: { type: "text", label: "Template (optional)", placeholder: "default" },
        status: { type: "select", label: "Initial Status", placeholder: "draft" },
      },
    },
    {
      type: "update_page",
      label: "Update Page",
      description: "Update content on an existing page",
      icon: "Edit",
      configSchema: {
        pageId: { type: "number", label: "Page ID", placeholder: "Leave empty to use selected page" },
      },
    },
    {
      type: "duplicate_page",
      label: "Duplicate Page",
      description: "Duplicate an existing page as a new draft",
      icon: "Copy",
      configSchema: {
        sourcePageId: { type: "number", label: "Source Page ID", placeholder: "Leave empty to use selected page" },
        newTitle: { type: "text", label: "New Title (optional)", placeholder: "Copy of original" },
      },
    },
    {
      type: "update_seo",
      label: "Update SEO",
      description: "Set or update Yoast SEO meta title, description, and keywords",
      icon: "Globe",
      configSchema: {
        pageId: { type: "number", label: "Page ID", placeholder: "Leave empty to use current" },
        title: { type: "text", label: "SEO Title (optional)", placeholder: "AI will generate if empty" },
        description: { type: "text", label: "Meta Description (optional)", placeholder: "AI will generate if empty" },
        focusKeyword: { type: "text", label: "Focus Keyword (optional)" },
      },
    },
    {
      type: "set_featured_image",
      label: "Set Featured Image",
      description: "Upload or assign a featured image to a page/post",
      icon: "Paperclip",
      configSchema: {
        pageId: { type: "number", label: "Page ID", placeholder: "Leave empty to use current" },
        imageUrl: { type: "text", label: "Image URL", placeholder: "https://..." },
        alt: { type: "text", label: "Alt Text", placeholder: "Descriptive alt text" },
      },
    },
    {
      type: "publish_page",
      label: "Publish Page",
      description: "Change page status to published",
      icon: "Check",
      configSchema: {
        pageId: { type: "number", label: "Page ID", placeholder: "Leave empty to use current" },
      },
    },
    {
      type: "schedule_page",
      label: "Schedule Page",
      description: "Schedule page for future publication",
      icon: "Clock",
      configSchema: {
        pageId: { type: "number", label: "Page ID", placeholder: "Leave empty to use current" },
        publishDate: { type: "text", label: "Publish Date", required: true, placeholder: "YYYY-MM-DDTHH:MM:SS" },
      },
    },
    {
      type: "create_post",
      label: "Create Post",
      description: "Create a new blog post with AI-generated content",
      icon: "Document",
      configSchema: {
        title: { type: "text", label: "Post Title", required: true, placeholder: "e.g. {{topic}} Blog Post" },
        slug: { type: "text", label: "Slug (optional)" },
        status: { type: "select", label: "Initial Status", placeholder: "draft" },
      },
    },
    {
      type: "update_product",
      label: "Update Product",
      description: "Update a WooCommerce product",
      icon: "BarChart",
      configSchema: {
        productId: { type: "number", label: "Product ID", required: true },
        name: { type: "text", label: "Product Name (optional)" },
        price: { type: "text", label: "Price (optional)" },
        salePrice: { type: "text", label: "Sale Price (optional)" },
      },
    },
    {
      type: "create_redirect",
      label: "Create Redirect",
      description: "Create a URL redirect (301/302)",
      icon: "ExternalLink",
      configSchema: {
        from: { type: "text", label: "From URL", required: true, placeholder: "/old-path" },
        to: { type: "text", label: "To URL", required: true, placeholder: "/new-path" },
        type: { type: "number", label: "Redirect Type", placeholder: "301" },
      },
    },
    {
      type: "clear_cache",
      label: "Clear Cache",
      description: "Clear the site cache",
      icon: "Refresh",
      configSchema: {},
    },
    {
      type: "send_notification",
      label: "Send Notification",
      description: "Log a notification about workflow completion",
      icon: "AlertCircle",
      configSchema: {
        message: { type: "text", label: "Notification Message", required: true, placeholder: "Workflow completed successfully" },
      },
    },
  ];
}

// --- Default workflow templates ---

function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function getDefaultWorkflows(): Workflow[] {
  const now = new Date().toISOString();
  return [
    {
      id: "tpl_launch_landing_page",
      name: "Launch Landing Page",
      description: "Create a landing page with AI content, optimize SEO, publish, and clear cache",
      icon: "Zap",
      isTemplate: true,
      runCount: 0,
      createdAt: now,
      steps: [
        {
          id: generateStepId(),
          type: "create_page",
          label: "Create Landing Page",
          description: "AI generates a complete landing page based on your topic",
          config: { title: "{{topic}} Landing Page", status: "draft" },
          usesAI: true,
          prompt: "Create a high-converting landing page for Z-Health Education about {{topic}}. Use the brand colors (black #080a0d, blue #2c8df3, red #d32431, lime #d0f689). Include a hero section, key benefits, social proof, and a clear CTA. Generate semantic HTML5 with inline styles.",
        },
        {
          id: generateStepId(),
          type: "update_seo",
          label: "Optimize SEO",
          description: "AI generates optimized meta title, description, and focus keyword",
          config: {},
          usesAI: true,
          prompt: "Generate an SEO-optimized meta title (50-60 chars), meta description (140-160 chars), and focus keyword for a Z-Health Education landing page about {{topic}}. Return as JSON: {title, description, focusKeyword}.",
        },
        {
          id: generateStepId(),
          type: "publish_page",
          label: "Publish Page",
          description: "Set the page status to published",
          config: {},
          usesAI: false,
        },
        {
          id: generateStepId(),
          type: "clear_cache",
          label: "Clear Cache",
          description: "Clear the site cache so changes appear immediately",
          config: {},
          usesAI: false,
        },
      ],
    },
    {
      id: "tpl_blog_post_pipeline",
      name: "Blog Post Pipeline",
      description: "Create a blog post with AI, optimize SEO, and schedule for publication",
      icon: "Document",
      isTemplate: true,
      runCount: 0,
      createdAt: now,
      steps: [
        {
          id: generateStepId(),
          type: "create_post",
          label: "Create Blog Post",
          description: "AI writes a full blog post based on your topic",
          config: { title: "{{topic}}", status: "draft" },
          usesAI: true,
          prompt: "Write a comprehensive, evidence-based blog post for Z-Health Education about {{topic}}. Target audience: movement professionals, physical therapists, coaches. Include an engaging introduction, structured sections with H2/H3 headings, practical takeaways, and a conclusion. Aim for 1200-1500 words.",
        },
        {
          id: generateStepId(),
          type: "update_seo",
          label: "Optimize SEO",
          description: "AI generates SEO metadata for the post",
          config: {},
          usesAI: true,
          prompt: "Generate an SEO-optimized meta title (50-60 chars), meta description (140-160 chars), and focus keyword for a Z-Health Education blog post about {{topic}}. Return as JSON: {title, description, focusKeyword}.",
        },
        {
          id: generateStepId(),
          type: "schedule_page",
          label: "Schedule Post",
          description: "Schedule the post for future publication",
          config: { publishDate: "{{publishDate}}" },
          usesAI: false,
        },
      ],
    },
    {
      id: "tpl_duplicate_customize",
      name: "Duplicate and Customize",
      description: "Duplicate an existing page, update with AI, optimize SEO, and publish",
      icon: "Copy",
      isTemplate: true,
      runCount: 0,
      createdAt: now,
      steps: [
        {
          id: generateStepId(),
          type: "duplicate_page",
          label: "Duplicate Page",
          description: "Create a copy of the selected page",
          config: {},
          usesAI: false,
        },
        {
          id: generateStepId(),
          type: "update_page",
          label: "Customize Content",
          description: "AI rewrites and customizes the duplicated page",
          config: {},
          usesAI: true,
          prompt: "Rewrite and customize this duplicated page for {{topic}}. Keep the same structure and layout but update the content to focus on the new topic. Maintain Z-Health Education brand voice.",
        },
        {
          id: generateStepId(),
          type: "update_seo",
          label: "Optimize SEO",
          description: "AI generates fresh SEO metadata",
          config: {},
          usesAI: true,
          prompt: "Generate SEO-optimized meta title, description, and focus keyword for this customized page about {{topic}}. Return as JSON: {title, description, focusKeyword}.",
        },
        {
          id: generateStepId(),
          type: "publish_page",
          label: "Publish Page",
          description: "Publish the customized page",
          config: {},
          usesAI: false,
        },
      ],
    },
    {
      id: "tpl_seo_audit_fix",
      name: "SEO Audit and Fix",
      description: "Analyze and fix SEO issues on a selected page",
      icon: "Globe",
      isTemplate: true,
      runCount: 0,
      createdAt: now,
      steps: [
        {
          id: generateStepId(),
          type: "update_seo",
          label: "Fix SEO Metadata",
          description: "AI analyzes the page and generates optimized SEO metadata",
          config: {},
          usesAI: true,
          prompt: "Analyze the content of this page and generate optimized SEO metadata. Create a compelling meta title (50-60 chars), meta description (140-160 chars), and suggest a focus keyword. Return as JSON: {title, description, focusKeyword}.",
        },
        {
          id: generateStepId(),
          type: "clear_cache",
          label: "Clear Cache",
          description: "Clear cache to reflect SEO changes",
          config: {},
          usesAI: false,
        },
      ],
    },
    {
      id: "tpl_sale_page_setup",
      name: "Sale Page Setup",
      description: "Duplicate a product page, customize with sale pricing, add redirect, publish, and clear cache",
      icon: "Zap",
      isTemplate: true,
      runCount: 0,
      createdAt: now,
      steps: [
        {
          id: generateStepId(),
          type: "duplicate_page",
          label: "Duplicate Product Page",
          description: "Copy the existing product/landing page",
          config: {},
          usesAI: false,
        },
        {
          id: generateStepId(),
          type: "update_page",
          label: "Add Sale Content",
          description: "AI updates the page with sale pricing and urgency elements",
          config: {},
          usesAI: true,
          prompt: "Update this page to be a sale/promotion page. Add sale pricing of {{salePrice}} (original {{originalPrice}}), urgency elements (limited time offer), countdown-style messaging, and a prominent CTA. Keep the Z-Health Education brand style with colors: black #080a0d, blue #2c8df3, red #d32431, lime #d0f689.",
        },
        {
          id: generateStepId(),
          type: "create_redirect",
          label: "Create Redirect",
          description: "Set up a redirect from a clean URL to the sale page",
          config: { from: "/{{saleSlug}}", to: "" },
          usesAI: false,
        },
        {
          id: generateStepId(),
          type: "publish_page",
          label: "Publish Sale Page",
          description: "Publish the sale page",
          config: {},
          usesAI: false,
        },
        {
          id: generateStepId(),
          type: "clear_cache",
          label: "Clear Cache",
          description: "Clear cache so the sale page is immediately live",
          config: {},
          usesAI: false,
        },
      ],
    },
  ];
}

// --- Storage ---

const DATA_DIR = path.join(process.cwd(), "src", "data");
const WORKFLOWS_FILE = path.join(DATA_DIR, "workflows.json");

async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readWorkflowsFile(): Promise<Workflow[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(WORKFLOWS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    // Initialize with default templates
    const defaults = getDefaultWorkflows();
    await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(defaults, null, 2), "utf-8");
    return defaults;
  }
}

async function writeWorkflowsFile(workflows: Workflow[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2), "utf-8");
}

export async function listWorkflows(): Promise<Workflow[]> {
  return readWorkflowsFile();
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const workflows = await readWorkflowsFile();
  return workflows.find((w) => w.id === id) || null;
}

export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const workflows = await readWorkflowsFile();
  const index = workflows.findIndex((w) => w.id === workflow.id);
  if (index >= 0) {
    workflows[index] = workflow;
  } else {
    workflows.push(workflow);
  }
  await writeWorkflowsFile(workflows);
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const workflows = await readWorkflowsFile();
  const index = workflows.findIndex((w) => w.id === id);
  if (index === -1) return false;
  workflows.splice(index, 1);
  await writeWorkflowsFile(workflows);
  return true;
}

export async function updateWorkflowRunStats(id: string): Promise<void> {
  const workflows = await readWorkflowsFile();
  const index = workflows.findIndex((w) => w.id === id);
  if (index >= 0) {
    workflows[index].lastRunAt = new Date().toISOString();
    workflows[index].runCount += 1;
    await writeWorkflowsFile(workflows);
  }
}
