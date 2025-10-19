// prisma-scripts/backfill-chatbotquestions-shop.js
import prisma from "../app/db.server.js"; // <-- correct relative path

async function main() {
  const defaultShop = "test1store-10024.myshopify.com"; // replace with actual shop

  const result = await prisma.chatbotQuestion.updateMany({
    where: { shop: "default-shop" },
    data: { shop: defaultShop },
  });

  console.log(`✅ Updated ${result.count} ChatbotQuestion rows with real shop.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
