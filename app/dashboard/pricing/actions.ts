"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function subscribeToPro() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const business = await prisma.business.findFirst({
    where: { memberships: { some: { userId: session.user.id, role: "OWNER" } } },
    select: { id: true },
  });
  if (!business) redirect("/dashboard");

  const paymentLink = process.env.REBILL_PAYMENT_LINK_URL;
  if (!paymentLink) throw new Error("Rebill no está configurado");
  redirect(paymentLink);
}
