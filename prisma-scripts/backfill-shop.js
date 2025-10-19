import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Fetch the first (or latest) session record
  const latestSession = await prisma.session.findFirst({
    orderBy: { id: "asc" }, // or "desc" if you want the latest
  });

  if (!latestSession) {
    console.log("No session found to use for backfill");
    process.exit(0);
  }

  const shop = latestSession.shop;
  console.log("Using shop:", shop);

  // Update all chatbotSettings that have null shop
  const result = await prisma.chatbotSettings.updateMany({
    where: { shop: null },
    data: { shop },
  });

  console.log(`✅ Updated ${result.count} chatbotSettings rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
