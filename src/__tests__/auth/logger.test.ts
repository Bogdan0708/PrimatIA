import { describe, expect, it } from "vitest";
import { ensureRequestId, getRequestLogContext } from "@/lib/logger";
import { NextRequest } from "next/server";

describe("logger helpers", () => {
  it("reuses an incoming request id when present", () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-request-id": "req-123",
      },
    });

    expect(ensureRequestId(request)).toBe("req-123");
    expect(getRequestLogContext(request)).toEqual(
      expect.objectContaining({
        requestId: "req-123",
        route: "/api/test",
        method: "GET",
      })
    );
  });

  it("generates a request id when none exists", () => {
    const request = new NextRequest("http://localhost/api/test");

    expect(ensureRequestId(request)).toBeTruthy();
  });
});
