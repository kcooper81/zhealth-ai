/**
 * Thinkific LMS API Client
 *
 * Uses the Thinkific API v2 with Bearer token authentication.
 * Docs: https://developers.thinkific.com/api/api-reference/
 */

const API_BASE = "https://api.thinkific.com/api/v2";

function getToken(): string {
  const token = process.env.THINKIFIC_API_TOKEN;
  if (!token) throw new Error("THINKIFIC_API_TOKEN not configured");
  return token;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function thinkificFetch(
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
      msg = err.error || err.message || response.statusText;
    } catch {
      msg = response.statusText;
    }
    throw new Error(`Thinkific API error (${response.status}): ${msg}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ---- Courses ----

export interface ThinkificCourse {
  id: number;
  name: string;
  slug: string;
  description?: string;
  course_card_image_url?: string;
  status: string;
  instructor_id?: number;
  reviews_enabled?: boolean;
  user_count?: number;
  chapter_count?: number;
  created_at?: string;
  updated_at?: string;
  price?: string;
}

export async function listCourses(params?: {
  page?: number;
  limit?: number;
}): Promise<{ items: ThinkificCourse[]; meta: { pagination: { total_items: number } } }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  return thinkificFetch(`/courses?${qs}`);
}

export async function getCourse(courseId: number): Promise<ThinkificCourse> {
  return thinkificFetch(`/courses/${courseId}`);
}

export async function updateCourse(
  courseId: number,
  data: Partial<Pick<ThinkificCourse, "name" | "description" | "status">>
): Promise<ThinkificCourse> {
  return thinkificFetch(`/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ---- Chapters ----

export interface ThinkificChapter {
  id: number;
  name: string;
  course_id: number;
  position: number;
  description?: string;
  content_count?: number;
}

export async function listChapters(
  courseId: number
): Promise<{ items: ThinkificChapter[] }> {
  return thinkificFetch(`/courses/${courseId}/chapters`);
}

// ---- Lessons (Contents) ----

export interface ThinkificContent {
  id: number;
  name: string;
  chapter_id: number;
  content_type: string;
  position: number;
  free?: boolean;
  description?: string;
}

export async function listContents(
  chapterId: number
): Promise<{ items: ThinkificContent[] }> {
  return thinkificFetch(`/chapters/${chapterId}/contents`);
}

// ---- Enrollments ----

export interface ThinkificEnrollment {
  id: number;
  user_id: number;
  course_id: number;
  user_name?: string;
  user_email?: string;
  course_name?: string;
  percentage_completed?: number;
  expired?: boolean;
  activated_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export async function listEnrollments(params?: {
  page?: number;
  limit?: number;
  course_id?: number;
  user_id?: number;
  query_email?: string;
}): Promise<{ items: ThinkificEnrollment[]; meta: { pagination: { total_items: number } } }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.course_id) qs.set("query[course_id]", String(params.course_id));
  if (params?.user_id) qs.set("query[user_id]", String(params.user_id));
  if (params?.query_email) qs.set("query[email]", params.query_email);

  return thinkificFetch(`/enrollments?${qs}`);
}

export async function createEnrollment(data: {
  user_id: number;
  course_id: number;
  activated_at?: string;
}): Promise<ThinkificEnrollment> {
  return thinkificFetch("/enrollments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEnrollment(
  enrollmentId: number,
  data: { expired?: boolean; activated_at?: string }
): Promise<ThinkificEnrollment> {
  return thinkificFetch(`/enrollments/${enrollmentId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ---- Users (Students) ----

export interface ThinkificUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  roles?: string[];
  sign_in_count?: number;
  current_sign_in_at?: string;
  created_at?: string;
  updated_at?: string;
}

export async function listUsers(params?: {
  page?: number;
  limit?: number;
  query_email?: string;
  query_name?: string;
}): Promise<{ items: ThinkificUser[]; meta: { pagination: { total_items: number } } }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.query_email) qs.set("query[email]", params.query_email);
  if (params?.query_name) qs.set("query[name]", params.query_name);

  return thinkificFetch(`/users?${qs}`);
}

export async function getUser(userId: number): Promise<ThinkificUser> {
  return thinkificFetch(`/users/${userId}`);
}

export async function createUser(data: {
  first_name: string;
  last_name: string;
  email: string;
  password?: string;
  send_welcome_email?: boolean;
}): Promise<ThinkificUser> {
  return thinkificFetch("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---- Products ----

export interface ThinkificProduct {
  id: number;
  name: string;
  slug: string;
  status: string;
  price: string;
  related_course_ids?: number[];
  created_at?: string;
}

export async function listProducts(params?: {
  page?: number;
  limit?: number;
}): Promise<{ items: ThinkificProduct[] }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  return thinkificFetch(`/products?${qs}`);
}

// ---- Orders ----

export interface ThinkificOrder {
  id: number;
  user_id: number;
  user_email?: string;
  user_name?: string;
  product_id: number;
  product_name?: string;
  amount_cents: number;
  status: string;
  created_at?: string;
}

export async function listOrders(params?: {
  page?: number;
  limit?: number;
  user_id?: number;
}): Promise<{ items: ThinkificOrder[]; meta: { pagination: { total_items: number } } }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.user_id) qs.set("query[user_id]", String(params.user_id));

  return thinkificFetch(`/orders?${qs}`);
}

// ---- Coupons / Promotions ----

export interface ThinkificCoupon {
  id: number;
  code: string;
  note?: string;
  quantity?: number;
  quantity_used?: number;
  percentage?: number;
  amount_cents?: number;
  expires_at?: string;
  created_at?: string;
}

export async function listCoupons(params?: {
  page?: number;
  limit?: number;
}): Promise<{ items: ThinkificCoupon[] }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  return thinkificFetch(`/coupons?${qs}`);
}

export async function createCoupon(data: {
  code: string;
  note?: string;
  quantity?: number;
  percentage?: number;
  amount_cents?: number;
  expires_at?: string;
  product_ids?: number[];
}): Promise<ThinkificCoupon> {
  return thinkificFetch("/coupons", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---- Analytics / Reports ----

export async function getCourseReport(courseId: number): Promise<{
  course: ThinkificCourse;
  chapters: ThinkificChapter[];
  total_enrollments: number;
  completion_rate: number;
}> {
  const [course, chapters, enrollments] = await Promise.all([
    getCourse(courseId),
    listChapters(courseId).then((r) => r.items),
    listEnrollments({ course_id: courseId, limit: 1 }),
  ]);

  const totalEnrollments = enrollments.meta.pagination.total_items;

  // Fetch a sample to estimate completion rate
  let completionRate = 0;
  if (totalEnrollments > 0) {
    const sample = await listEnrollments({ course_id: courseId, limit: 100 });
    const completed = sample.items.filter((e) => e.completed_at).length;
    completionRate = Math.round((completed / sample.items.length) * 100);
  }

  return { course, chapters, total_enrollments: totalEnrollments, completion_rate: completionRate };
}

export async function getLMSOverview(): Promise<{
  total_courses: number;
  total_students: number;
  total_enrollments: number;
  total_orders: number;
}> {
  const [courses, users, enrollments, orders] = await Promise.all([
    listCourses({ limit: 1 }).catch(() => ({ meta: { pagination: { total_items: 0 } } })),
    listUsers({ limit: 1 }).catch(() => ({ meta: { pagination: { total_items: 0 } } })),
    listEnrollments({ limit: 1 }).catch(() => ({ meta: { pagination: { total_items: 0 } } })),
    listOrders({ limit: 1 }).catch(() => ({ meta: { pagination: { total_items: 0 } } })),
  ]);

  return {
    total_courses: (courses as any).meta?.pagination?.total_items || 0,
    total_students: (users as any).meta?.pagination?.total_items || 0,
    total_enrollments: (enrollments as any).meta?.pagination?.total_items || 0,
    total_orders: (orders as any).meta?.pagination?.total_items || 0,
  };
}

// ---- Capabilities for AI context ----

export function getThinkificCapabilities(): string[] {
  return [
    "List and view all courses with details",
    "Update course names, descriptions, and status",
    "View course chapters and lesson structure",
    "List, search, and create student accounts",
    "Manage enrollments (enroll students, check progress, expire access)",
    "View orders and revenue",
    "Create and manage coupon/promo codes",
    "Generate course completion reports",
    "Get LMS overview statistics",
  ];
}

export function getThinkificContext(): string {
  return `
## Thinkific LMS Integration
You can manage the Z-Health Thinkific LMS (courses.zhealtheducation.com). Available actions:
- **Courses**: List all courses, view details (enrollment count, chapters, status), update course info
- **Students**: Search students by name/email, create new student accounts, view sign-in activity
- **Enrollments**: Enroll students in courses, check completion progress, expire/extend access
- **Orders**: View purchase history, filter by student
- **Coupons**: Create promo codes with percentage or fixed discounts, set expiry dates and limits
- **Reports**: Course completion rates, LMS overview stats (total students, enrollments, orders)

When the user asks about courses, students, enrollments, or LMS tasks, use the Thinkific integration.
Action types for Thinkific:
- thinkific_list_courses, thinkific_get_course, thinkific_update_course
- thinkific_list_students, thinkific_get_student, thinkific_create_student
- thinkific_list_enrollments, thinkific_create_enrollment, thinkific_update_enrollment
- thinkific_list_orders
- thinkific_list_coupons, thinkific_create_coupon
- thinkific_course_report, thinkific_lms_overview
`;
}

export function isConfigured(): boolean {
  return !!process.env.THINKIFIC_API_TOKEN;
}
