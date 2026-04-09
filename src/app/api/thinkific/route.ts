import { NextRequest, NextResponse } from "next/server";
import * as thinkific from "@/lib/thinkific";
import { logError } from "@/lib/error-logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (!thinkific.isConfigured()) {
      return NextResponse.json(
        { error: "Thinkific API token not configured" },
        { status: 400 }
      );
    }

    switch (action) {
      case "courses": {
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const result = await thinkific.listCourses({ page, limit });
        return NextResponse.json(result);
      }

      case "course": {
        const id = parseInt(searchParams.get("id") || "0");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const course = await thinkific.getCourse(id);
        return NextResponse.json(course);
      }

      case "chapters": {
        const courseId = parseInt(searchParams.get("course_id") || "0");
        if (!courseId) return NextResponse.json({ error: "course_id required" }, { status: 400 });
        const result = await thinkific.listChapters(courseId);
        return NextResponse.json(result);
      }

      case "students": {
        const email = searchParams.get("email") || undefined;
        const name = searchParams.get("name") || undefined;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "30");
        const result = await thinkific.listUsers({ page, limit, query_email: email, query_name: name });
        return NextResponse.json(result);
      }

      case "student": {
        const id = parseInt(searchParams.get("id") || "0");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const user = await thinkific.getUser(id);
        return NextResponse.json(user);
      }

      case "enrollments": {
        const courseId = searchParams.get("course_id") ? parseInt(searchParams.get("course_id")!) : undefined;
        const userId = searchParams.get("user_id") ? parseInt(searchParams.get("user_id")!) : undefined;
        const email = searchParams.get("email") || undefined;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "30");
        const result = await thinkific.listEnrollments({ page, limit, course_id: courseId, user_id: userId, query_email: email });
        return NextResponse.json(result);
      }

      case "orders": {
        const userId = searchParams.get("user_id") ? parseInt(searchParams.get("user_id")!) : undefined;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "30");
        const result = await thinkific.listOrders({ page, limit, user_id: userId });
        return NextResponse.json(result);
      }

      case "products": {
        const result = await thinkific.listProducts({ limit: 50 });
        return NextResponse.json(result);
      }

      case "coupons": {
        const result = await thinkific.listCoupons({ limit: 50 });
        return NextResponse.json(result);
      }

      case "course-report": {
        const courseId = parseInt(searchParams.get("course_id") || "0");
        if (!courseId) return NextResponse.json({ error: "course_id required" }, { status: 400 });
        const report = await thinkific.getCourseReport(courseId);
        return NextResponse.json(report);
      }

      case "overview": {
        const overview = await thinkific.getLMSOverview();
        return NextResponse.json(overview);
      }

      default:
        return NextResponse.json(
          { error: "Unknown action. Use: courses, students, enrollments, orders, products, coupons, course-report, overview" },
          { status: 400 }
        );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Thinkific API error";
    logError("api/thinkific", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!thinkific.isConfigured()) {
      return NextResponse.json(
        { error: "Thinkific API token not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create_student": {
        const user = await thinkific.createUser(body.data);
        return NextResponse.json({ success: true, user });
      }

      case "create_enrollment": {
        const enrollment = await thinkific.createEnrollment(body.data);
        return NextResponse.json({ success: true, enrollment });
      }

      case "update_enrollment": {
        const enrollment = await thinkific.updateEnrollment(body.enrollmentId, body.data);
        return NextResponse.json({ success: true, enrollment });
      }

      case "update_course": {
        const course = await thinkific.updateCourse(body.courseId, body.data);
        return NextResponse.json({ success: true, course });
      }

      case "create_coupon": {
        const coupon = await thinkific.createCoupon(body.data);
        return NextResponse.json({ success: true, coupon });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Thinkific API error";
    logError("api/thinkific", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
