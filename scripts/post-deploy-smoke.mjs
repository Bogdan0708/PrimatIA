const baseUrl = (
  process.env.APP_BASE_URL ??
  process.env.NEXTAUTH_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  ""
).replace(/\/+$/, "");

if (!baseUrl) {
  console.error("[post-deploy-smoke] APP_BASE_URL, NEXTAUTH_URL, or PLAYWRIGHT_BASE_URL must be set.");
  process.exit(1);
}

const checks = [
  {
    name: "liveness",
    path: "/api/health",
    expect: body => body?.status === "ok",
  },
  {
    name: "deep-health",
    path: "/api/health/deep",
    expect: body =>
      body?.status === "ok" &&
      body?.database?.status === "ok" &&
      body?.redis?.status === "ok" &&
      body?.ai?.status !== "error",
  },
  {
    name: "staff-login-page",
    path: "/ro/login",
    expect: (_body, response) => response.ok,
  },
  {
    name: "citizen-login-page",
    path: "/ro/portal/login",
    expect: (_body, response) => response.ok,
  },
  {
    name: "citizen-register-page",
    path: "/ro/portal/register",
    expect: (_body, response) => response.ok,
  },
];

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url, {
    headers: {
      Accept: check.path.startsWith("/api/") ? "application/json" : "text/html",
    },
    cache: "no-store",
    redirect: "follow",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : null;

  if (!check.expect(body, response)) {
    throw new Error(
      `${check.name} failed for ${url} with HTTP ${response.status}` +
        (body ? ` and payload ${JSON.stringify(body)}` : "")
    );
  }

  console.log(
    `[post-deploy-smoke] OK ${check.name} ${response.status} ${url}` +
      (body?.status ? ` status=${body.status}` : "")
  );
}

for (const check of checks) {
  await runCheck(check);
}

console.log("[post-deploy-smoke] OK");
