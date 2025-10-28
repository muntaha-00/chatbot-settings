import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_SHOP = "test1store-10024.myshopify.com";

async function initializeChatbotSettings() {
  const existing = await prisma.chatbotSettings.findFirst({
    where: { shop: DEFAULT_SHOP },
  });

  if (!existing) {
    await prisma.chatbotSettings.create({
      data: {
        shop: DEFAULT_SHOP,
        chatbotName: "Store Assistant",
        welcomeMessage: "Hi! How can I help you today?",
        isActive: true,
        primaryColor: "#007bff",
        position: "bottom-right"
      },
    });
    console.log(`✅ Created default ChatbotSettings`);
  } else {
    console.log(`ℹ️ ChatbotSettings already exist`);
  }
}

async function updateChatbotQuestions() {
  // First create some default questions if none exist
  const questionCount = await prisma.chatbotQuestion.count();
  
  if (questionCount === 0) {
    await prisma.chatbotQuestion.createMany({
      data: [
        {
          shop: DEFAULT_SHOP,
          question: "What are your shipping options?",
          answer: "We offer standard and express shipping."
        },
        {
          shop: DEFAULT_SHOP,
          question: "Do you offer returns?",
          answer: "Yes, we have a 30-day return policy."
        }
      ]
    });
    console.log('✅ Created default questions');
  } else {
    console.log('ℹ️ Questions already exist');
  }
}

async function main() {
  try {
    await initializeChatbotSettings();
    await updateChatbotQuestions();
    console.log('All initialization complete');
  } catch (error) {
    console.error('Error during initialization:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();