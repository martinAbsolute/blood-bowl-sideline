// Keep the browser on the configured OAuth origin so its PKCE/state cookies
// are sent back to the callback. Convex remains responsible for verification.
export async function proxyTelegramAuth(request: Request) {
  const url = new URL(request.url);
  if (!/^\/api\/auth\/(signin|callback)\/telegram$/.test(url.pathname)) {
    return new Response("Not found", { status: 404 });
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl)
    return new Response("Authentication unavailable", { status: 503 });
  const site = new URL(convexUrl);
  site.hostname = site.hostname.replace(/\.convex\.cloud$/, ".convex.site");
  const target = new URL(url.pathname + url.search, site);
  const headers = new Headers();
  for (const name of ["cookie", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "POST" ? await request.text() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    for (const name of ["location", "content-type"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", cookie);
    }
    responseHeaders.set("cache-control", "no-store");
    responseHeaders.set("referrer-policy", "no-referrer");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    // Never log OAuth URLs, codes, cookies, or provider response bodies.
    console.error("Telegram authentication upstream unavailable");
    return new Response("Authentication unavailable", { status: 502 });
  }
}
