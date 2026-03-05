import { PrismaClient, role_enum } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

async function runSeed() {
  const adminPasswordHash = await hashPassword("ADMIN001");
  const userPasswordHash = await hashPassword("EMP001");

  await prisma.users.upsert({
    where: { email: "admin@company.com" },
    update: {
      employee_id: "ADMIN001",
      name: "System Admin",
      department: "HQ",
      team: "IT",
      role: role_enum.ADMIN,
      is_active: true,
      is_first_login: false,
      password_hash: adminPasswordHash
    },
    create: {
      email: "admin@company.com",
      employee_id: "ADMIN001",
      name: "System Admin",
      department: "HQ",
      team: "IT",
      role: role_enum.ADMIN,
      is_active: true,
      is_first_login: false,
      password_hash: adminPasswordHash
    }
  });

  await prisma.users.upsert({
    where: { email: "user1@company.com" },
    update: {
      employee_id: "EMP001",
      name: "General User",
      department: "Sales",
      team: "Domestic",
      role: role_enum.USER,
      is_active: true,
      is_first_login: true,
      password_hash: userPasswordHash
    },
    create: {
      email: "user1@company.com",
      employee_id: "EMP001",
      name: "General User",
      department: "Sales",
      team: "Domestic",
      role: role_enum.USER,
      is_active: true,
      is_first_login: true,
      password_hash: userPasswordHash
    }
  });

  console.log("Seed completed");
}

runSeed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
