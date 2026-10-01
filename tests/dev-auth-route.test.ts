import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";

const { backendQuery } = vi.hoisted(() => ({ backendQuery: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = backendQuery;
  },
}));
import { GET, POST } from "../src/app/api/dev-auth/route";

const secret = "test-only-development-secret-of-sufficient-length";
const userId = "jd7b9f8k4k5ey4yjfyfgjb1w8588kc91";
function request(
  body: unknown = { userId },
  origin: string | null = "http://localhost:3000",
) {
  return new Request("http://localhost:3000/api/dev-auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("VERCEL_TARGET_ENV", undefined);
  vi.stubEnv("CONVEX_DEPLOY_KEY", undefined);
  vi.stubEnv("DEV_AUTH_ENABLED", "true");
  vi.stubEnv("DEV_AUTH_SECRET", secret);
  vi.stubEnv(
    "NEXT_PUBLIC_CONVEX_URL",
    "https://test-coach-123.eu-west-1.convex.cloud",
  );
  backendQuery.mockReset().mockResolvedValue({
    enabled: true,
    environment: "development",
    deploymentName: "test-coach-123",
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("development sign-in endpoint", () => {
  it("advertises the bypass only when both gates match and never caches it", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ enabled: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["production", "preview"])(
    "fails closed for mismatched backend environment %s",
    async (environment) => {
      backendQuery.mockResolvedValue({
        enabled: true,
        environment,
        deploymentName: "test-coach-123",
      });
      expect(await (await GET()).json()).toEqual({ enabled: false });
      expect((await POST(request())).status).toBe(404);
    },
  );
  it.each([
    { enabled: false, environment: null, deploymentName: null },
    {
      enabled: true,
      environment: "development",
      deploymentName: "another-coach-456",
    },
  ])("rejects disabled or wrong backend metadata", async (metadata) => {
    backendQuery.mockResolvedValue(metadata);
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect((await POST(request())).status).toBe(404);
  });
  it("fails closed when Convex cannot be contacted", async () => {
    backendQuery.mockRejectedValue(new Error("Offline"));
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect((await POST(request())).status).toBe(404);
  });
  it("rejects production even when every opt-in flag and secret is present", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect((await POST(request())).status).toBe(404);
    expect(backendQuery).not.toHaveBeenCalled();
  });
  it.each(["https://evil.example", null])(
    "rejects cross-origin or missing-origin POST %s",
    async (origin) => {
      expect((await POST(request({ userId }, origin))).status).toBe(403);
      expect(backendQuery).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    {},
    { userId: 23 },
    { userId: "invalid id" },
    { userId: "a".repeat(1100) },
  ])("rejects malformed identity input", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
  });
  it("issues a short-lived signed subject without accepting a client role or environment", async () => {
    const response = await POST(
      request({ userId, role: "admin", environment: "production" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { token } = await response.json();
    const { payload, protectedHeader } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        algorithms: ["HS256"],
        issuer: "sideline-dev-auth",
        audience: "dev-impersonation",
      },
    );
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.sub).toBe(userId);
    expect(payload.environment).toBe("development");
    expect(payload.deploymentName).toBe("test-coach-123");
    expect(payload.role).toBeUndefined();
    expect(payload.exp! - payload.iat!).toBe(60);
  });
  it("supports a matching Vercel preview with production NODE_ENV", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    backendQuery.mockResolvedValue({
      enabled: true,
      environment: "preview",
      deploymentName: "test-coach-123",
    });
    expect((await POST(request())).status).toBe(200);
  });
});
