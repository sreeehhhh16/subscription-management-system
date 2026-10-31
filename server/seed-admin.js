const bcrypt = require("bcrypt");
const prisma = require("./db");

async function main() {
  const email = "admin@brightloop.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin already exists");
    return;
  }
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("Admin@12345", 10),
      name: "Admin",
      role: "ADMIN",
    },
  });
  console.log("Admin created: admin@brightloop.com / Admin@12345");
}

main().finally(() => prisma.$disconnect());
