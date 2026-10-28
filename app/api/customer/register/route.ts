import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function POST(req: Request) {
  try {
    const { name, email: rawEmail, phone, password, restaurantSlug } = await req.json();

    if (!name || !rawEmail || !phone || !password || !restaurantSlug) {
      return NextResponse.json({ error: "Complet\u00e1 todos los campos para crear tu cuenta." }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
    if (!restaurant) {
      return NextResponse.json({ error: "No encontramos este local. Volv\u00e9 al men\u00fa e intent\u00e1 otra vez." }, { status: 404 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (!existing.passwordHash) {
        return NextResponse.json(
          { code: "ACCOUNT_WITHOUT_PASSWORD", error: "Este email ya tiene una cuenta sin contrase\u00f1a. Contact\u00e1 al local para recuperar el acceso." },
          { status: 401 },
        );
      }
      if (!(await bcrypt.compare(password, existing.passwordHash))) {
        return NextResponse.json({ code: "EMAIL_ALREADY_REGISTERED", error: "Ese email ya est\u00e1 registrado. Inici\u00e1 sesi\u00f3n con tu contrase\u00f1a o prob\u00e1 con otro email." }, { status: 401 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const alreadyCustomer = await tx.customer.findUnique({
          where: { businessId_userId: { businessId: restaurant.businessId, userId: existing.id } },
        });
        if (alreadyCustomer) return "already-customer" as const;

        const userWithPhone = await tx.user.findUnique({ where: { phone } });
        if (userWithPhone && userWithPhone.id !== existing.id) return "phone-in-use" as const;

        const customerByPhone = await tx.customer.findUnique({
          where: { businessId_phone: { businessId: restaurant.businessId, phone } },
        });
        if (customerByPhone?.userId && customerByPhone.userId !== existing.id) {
          return "phone-in-use" as const;
        }

        if (customerByPhone) {
          await tx.customer.update({
            where: { id: customerByPhone.id },
            data: { userId: existing.id, name: existing.name, email, phone },
          });
        } else {
          await tx.customer.create({
            data: { businessId: restaurant.businessId, userId: existing.id, name: existing.name, email, phone },
          });
        }

        return "created" as const;
      });

      if (result === "already-customer") {
        return NextResponse.json({ code: "ALREADY_CUSTOMER", error: "Ya ten\u00e9s una cuenta en este local. Inici\u00e1 sesi\u00f3n para ver tus puntos." }, { status: 409 });
      }
      if (result === "phone-in-use") {
        return NextResponse.json({ code: "PHONE_IN_USE", error: "Ese tel\u00e9fono ya est\u00e1 asociado a otra cuenta de este local. Inici\u00e1 sesi\u00f3n con esa cuenta o revis\u00e1 el n\u00famero." }, { status: 409 });
      }

      return NextResponse.json({}, { status: 201 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await prisma.$transaction(async (tx) => {
      const userWithPhone = await tx.user.findUnique({ where: { phone } });
      if (userWithPhone) return "phone-account-exists" as const;

      const customerByPhone = await tx.customer.findUnique({
        where: { businessId_phone: { businessId: restaurant.businessId, phone } },
      });
      if (customerByPhone?.userId) return "phone-in-use" as const;

      const user = await tx.user.create({ data: { email, name, phone, passwordHash } });

      if (customerByPhone) {
        await tx.customer.update({
          where: { id: customerByPhone.id },
          data: { userId: user.id, name, email, phone },
        });
      } else {
        await tx.customer.create({
          data: { businessId: restaurant.businessId, userId: user.id, name, email, phone },
        });
      }

      return "created" as const;
    });

    if (result === "phone-account-exists") {
      return NextResponse.json({ code: "PHONE_ACCOUNT_EXISTS", error: "Ese tel\u00e9fono ya tiene una cuenta. Inici\u00e1 sesi\u00f3n con el email de esa cuenta. Si no lo record\u00e1s, contact\u00e1 al local." }, { status: 409 });
    }
    if (result === "phone-in-use") {
      return NextResponse.json({ code: "PHONE_IN_USE", error: "Ese tel\u00e9fono ya est\u00e1 asociado a otra cuenta de este local. Inici\u00e1 sesi\u00f3n con esa cuenta o revis\u00e1 el n\u00famero." }, { status: 409 });
    }

    return NextResponse.json({}, { status: 201 });
  } catch (err) {
    console.error("[POST /api/customer/register]", err);
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ code: "DUPLICATE_DETAILS", error: "El email o el tel\u00e9fono ya est\u00e1n registrados. Inici\u00e1 sesi\u00f3n con tu cuenta o revis\u00e1 los datos." }, { status: 409 });
    }
    return NextResponse.json({ error: "No pudimos crear tu cuenta por un problema temporal. Tus datos no se guardaron. Prob\u00e1 otra vez; si vuelve a pasar, contact\u00e1 al local." }, { status: 500 });
  }
}
