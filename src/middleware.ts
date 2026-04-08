// Auth middleware disabled. See GOOGLE-AUTH-SETUP.md to enable.
// This file intentionally left as a no-op.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
