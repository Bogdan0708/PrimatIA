import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { rejectCrossOriginMutation } from "@/middleware";

const API_URL = "http://localhost:3000/api/portal/gdpr/erasure";
const HEALTH_URL = "http://localhost:3000/api/health";

function req(url: string, init: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

describe("rejectCrossOriginMutation (CSRF guard)", () => {
  it("(a) POST with no Origin/Referer and no X-Requested-With -> 403", () => {
    const result = rejectCrossOriginMutation(req(API_URL, { method: "POST" }));
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("(b) POST with no Origin/Referer but X-Requested-With: fetch -> allowed", () => {
    const result = rejectCrossOriginMutation(
      req(API_URL, {
        method: "POST",
        headers: { "x-requested-with": "fetch" },
      })
    );
    expect(result).toBeNull();
  });

  it("(b') POST with X-Requested-With: XMLHttpRequest -> allowed", () => {
    const result = rejectCrossOriginMutation(
      req(API_URL, {
        method: "POST",
        headers: { "x-requested-with": "XMLHttpRequest" },
      })
    );
    expect(result).toBeNull();
  });

  it("(c) POST with matching Origin -> allowed", () => {
    const result = rejectCrossOriginMutation(
      req(API_URL, {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      })
    );
    expect(result).toBeNull();
  });

  it("(d) POST with mismatched Origin -> 403", () => {
    const result = rejectCrossOriginMutation(
      req(API_URL, {
        method: "POST",
        headers: { origin: "http://evil.example.com" },
      })
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("(e) GET with no headers -> allowed", () => {
    const result = rejectCrossOriginMutation(req(API_URL, { method: "GET" }));
    expect(result).toBeNull();
  });

  it("(f) health endpoint POST without headers -> allowed", () => {
    const result = rejectCrossOriginMutation(req(HEALTH_URL, { method: "POST" }));
    expect(result).toBeNull();
  });

  it("non-API path is never blocked, regardless of headers", () => {
    const result = rejectCrossOriginMutation(
      req("http://localhost:3000/ro/portal/dashboard", { method: "POST" })
    );
    expect(result).toBeNull();
  });

  it("Stripe webhook path is never blocked (has its own signature check)", () => {
    const result = rejectCrossOriginMutation(
      req("http://localhost:3000/api/payments/webhook", { method: "POST" })
    );
    expect(result).toBeNull();
  });
});
