import { afterEach, expect, it, vi } from "vitest";
import { proxyTelegramAuth } from "../src/lib/auth-proxy";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("forwards sign-in to Convex without following Telegram redirects and preserves each cookie", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  const upstream = new Response(null, {
    status: 302,
    headers: { location: "https://oauth.telegram.org/auth" },
  });
  upstream.headers.append(
    "set-cookie",
    "__Host-telegramOAuthstate=test-state; Path=/; Secure; HttpOnly; SameSite=Lax",
  );
  upstream.headers.append(
    "set-cookie",
    "__Host-telegramOAuthpkce=test-pkce; Path=/; Secure; HttpOnly; SameSite=Lax",
  );
  const fetch = vi.fn().mockResolvedValue(upstream);
  vi.stubGlobal("fetch", fetch);
  const response = await proxyTelegramAuth(
    new Request(
      "https://sideline.example/api/auth/signin/telegram?code=test-verifier&redirectTo=%2Fbuilder%3Fdraft%3Dtest",
    ),
  );
  expect(fetch.mock.calls[0][0].href).toBe(
    "https://example.convex.site/api/auth/signin/telegram?code=test-verifier&redirectTo=%2Fbuilder%3Fdraft%3Dtest",
  );
  expect(fetch.mock.calls[0][1]).toMatchObject({
    redirect: "manual",
    cache: "no-store",
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    "https://oauth.telegram.org/auth",
  );
  expect(response.headers.getSetCookie()).toEqual(
    upstream.headers.getSetCookie(),
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("passes callback cookies and form body to Convex for verification", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  const fetch = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: {
        location:
          "https://sideline.example/builder?draft=uuid&code=verification",
      },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const response = await proxyTelegramAuth(
    new Request("https://sideline.example/api/auth/callback/telegram", {
      method: "POST",
      headers: {
        cookie: "state=test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "code=provider-code&state=test",
    }),
  );
  const options = fetch.mock.calls[0][1];
  expect(options.method).toBe("POST");
  expect(options.headers.get("cookie")).toBe("state=test");
  expect(options.body).toBe("code=provider-code&state=test");
  expect(response.headers.get("location")).toContain(
    "draft=uuid&code=verification",
  );
});

it("does not expose arbitrary backend routes through the proxy", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(
    (
      await proxyTelegramAuth(
        new Request("https://sideline.example/api/auth/anything/telegram"),
      )
    ).status,
  ).toBe(404);
  expect(fetch).not.toHaveBeenCalled();
});

it("derives regional Convex HTTP endpoints from the cloud URL", async () => {
  vi.stubEnv(
    "NEXT_PUBLIC_CONVEX_URL",
    "https://example.eu-west-1.convex.cloud",
  );
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
  vi.stubGlobal("fetch", fetch);
  await proxyTelegramAuth(
    new Request("https://sideline.example/api/auth/signin/telegram"),
  );
  expect(fetch.mock.calls[0][0].origin).toBe(
    "https://example.eu-west-1.convex.site",
  );
});

it("reports unavailable authentication when the Convex URL is missing", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await proxyTelegramAuth(
    new Request("https://sideline.example/api/auth/signin/telegram"),
  );
  expect(response.status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});
