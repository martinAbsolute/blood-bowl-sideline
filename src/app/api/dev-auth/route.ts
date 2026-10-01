import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import {
  getFrontendDevAuthConfig,
  mintDevAuthToken,
  type FrontendDevAuthConfig,
} from "@/lib/dev-auth";

const noStore = { "Cache-Control": "no-store" };

async function matchingBackend(config: FrontendDevAuthConfig) {
  try {
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const backend = await client.query(api.devAuth.status, {});
    return (
      backend.enabled &&
      backend.environment === config.environment &&
      backend.deploymentName === config.deploymentName
    );
  } catch {
    return false;
  }
}

export async function GET() {
  const config = getFrontendDevAuthConfig();
  return Response.json(
    { enabled: !!config && (await matchingBackend(config)) },
    { headers: noStore },
  );
}

export async function POST(request: Request) {
  const config = getFrontendDevAuthConfig();
  if (!config)
    return Response.json(
      { error: "Unavailable" },
      { status: 404, headers: noStore },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json(
      { error: "Forbidden" },
      { status: 403, headers: noStore },
    );
  }
  if (!(await matchingBackend(config))) {
    return Response.json(
      { error: "Unavailable" },
      { status: 404, headers: noStore },
    );
  }
  try {
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new Error("Invalid input");
    const raw = await request.text();
    if (raw.length > 1024) throw new Error("Invalid input");
    const body: unknown = JSON.parse(raw);
    if (
      !body ||
      typeof body !== "object" ||
      !("userId" in body) ||
      typeof body.userId !== "string" ||
      !/^[a-z0-9]{16,100}$/.test(body.userId)
    )
      throw new Error("Invalid input");
    const token = await mintDevAuthToken(body.userId, config);
    return Response.json({ token }, { headers: noStore });
  } catch {
    return Response.json(
      { error: "Invalid input" },
      { status: 400, headers: noStore },
    );
  }
}
