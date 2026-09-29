import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRebillConfig, rebillRequest, signCheckout } from "@/lib/rebill-checkout";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const unavailable = () => NextResponse.redirect(new URL("/dashboard/pricing?checkoutError=1", origin), 303);
  try {
    if (request.headers.get("origin") !== origin) return NextResponse.json({ error: "Origen inválido" }, { status: 403 });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.redirect(new URL("/login", origin), 303);
    const config = getRebillConfig();
    if (!config || !process.env.AUTH_SECRET) return unavailable();
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, role: "OWNER" },
      select: { businessId: true, business: { select: { plan: true } } },
      orderBy: { id: "asc" },
    });
    if (!membership) return unavailable();
    if (membership.business.plan === "pro") return NextResponse.redirect(new URL("/dashboard/pricing", origin), 303);

    const template = await rebillRequest<{
      organizationId: string;
      plan?: { id?: string };
      title: { text: string; language: string }[];
      paymentMethods: { methods: string[]; currency: string }[];
      showCoupon?: boolean;
    }>(config, `payment-links/${encodeURIComponent(config.templateLinkId)}`);
    if (template.plan?.id !== config.planId || template.organizationId.startsWith("test_org_") !== (config.mode === "sandbox")) {
      throw new Error("Rebill template does not match configured plan/environment");
    }
    const now = Date.now();
    const link = await rebillRequest<{ id: string; url: string }>(config, "payment-links", {
      method: "POST",
      body: JSON.stringify({
        title: template.title,
        paymentMethods: template.paymentMethods,
        plan: { id: config.planId },
        showCoupon: template.showCoupon ?? false,
        status: "draft",
        expirationDate: new Date(now + 172_800_000).toISOString(),
      }),
    });
    const hostedUrl = new URL(link.url);
    if (hostedUrl.protocol !== "https:" || hostedUrl.hostname !== "pay.rebill.com") throw new Error("Invalid Rebill checkout URL");
    const token = signCheckout({ userId: session.user.id, businessId: membership.businessId, planId: config.planId, paymentLinkId: link.id, mode: config.mode, createdAt: now, expiresAt: now + 172_800_000 });
    const approved = new URL("/dashboard/pricing/return", origin);
    approved.searchParams.set("checkout", token);
    const rejected = new URL(approved);
    rejected.searchParams.set("status", "rejected");
    await rebillRequest(config, `payment-links/${encodeURIComponent(link.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active", metadata: { platorestCheckout: token }, redirectUrls: { approved: approved.href, rejected: rejected.href } }),
    });
    return NextResponse.redirect(hostedUrl, 303);
  } catch (error) {
    console.error("[rebill checkout]", error instanceof Error ? error.message : "checkout failed");
    return unavailable();
  }
}
