import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = (await auth())?.user?.id;
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const membership = await prisma.membership.findFirst({
      where: { userId, role: "OWNER" },
      select: { business: { select: { plan: true } } },
      orderBy: { id: "asc" },
    });

    return NextResponse.json(
      { active: membership?.business.plan === "pro" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[GET /api/rebill/status]", error);
    return NextResponse.json({ error: "status_unavailable" }, { status: 500 });
  }
}
