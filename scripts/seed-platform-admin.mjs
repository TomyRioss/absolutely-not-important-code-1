import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config({ path: ".env.local" });

const credentialFile = await readFile("docs/CREDENTIALS.md", "utf8");
const email = credentialFile.match(/^- Email: `([^`]+)`/m)?.[1]?.trim().toLowerCase();
const password = credentialFile.match(/^- Contraseña: `([^`]+)`/m)?.[1];

if (!email || !password) {
  throw new Error("docs/CREDENTIALS.md must contain the platform admin email and password.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name: "Tomy", passwordHash, platformRole: "ADMIN" },
    create: { email, name: "Tomy", passwordHash, platformRole: "ADMIN" },
  });
  console.log(`Platform admin seed ready for ${email}.`);
} finally {
  await prisma.$disconnect();
}
