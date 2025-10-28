import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response.js";

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;
    
    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const questions = await prisma.chatbotQuestion.findMany({
      where: { shop, isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        question: true,
        answer: true,
        productId: true,
        productTitle: true,
        customerName: true,
      },
    });

    return json({ questions });
  } catch (error) {
    console.error("❌ Error in chat API loader:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};

export const action = async ({ request }) => {
  try {
    const data = await request.json();
    
    const isAdminSave = Array.isArray(data.questions);
    const isStorefrontQuery = data.question && typeof data.question === "string";

    // ADMIN: Save/update chatbot Q&A
    if (isAdminSave) {
      const { session } = await authenticate.admin(request);
      const shop = session?.shop;
      
      if (!shop) {
        return json({ error: "Unauthorized" }, { status: 401 });
      }

      const { questions } = data;

      if (!Array.isArray(questions)) {
        return json({ error: "Invalid questions format" }, { status: 400 });
      }

      const validQuestions = questions.filter(q => {
        const question = String(q.question || "").trim();
        const answer = String(q.answer || "").trim();
        return question.length > 0 && answer.length > 0;
      });

      if (validQuestions.length === 0 && questions.length > 0) {
        return json({ 
          error: "All questions must have both question and answer text" 
        }, { status: 400 });
      }

      await prisma.$transaction([
        prisma.chatbotQuestion.deleteMany({ where: { shop } }),
        ...(validQuestions.length > 0 ? [
          prisma.chatbotQuestion.createMany({
            data: validQuestions.map((q) => ({
              shop,
              question: String(q.question).trim(),
              answer: String(q.answer).trim(),
              productId: q.productId || null,
              productTitle: q.productTitle || null,
              customerName: q.customerName || null,
              isActive: q.isActive ?? true,
            })),
          })
        ] : [])
      ]);

      return json({ success: true, message: "Questions saved successfully" });
    }

    // STOREFRONT: Answer customer question
    if (isStorefrontQuery) {
      const { shop, question, productId } = data;

      if (!shop) {
        return json({ error: "Missing shop parameter" }, { status: 400 });
      }

      const shopSettings = await prisma.chatbotSettings.findUnique({
        where: { shop },
      });

      if (!shopSettings || !shopSettings.isActive) {
        return json({ 
          answer: "This chatbot is currently unavailable.",
        });
      }

      const matchedQuestion = await prisma.chatbotQuestion.findFirst({
        where: {
          shop,
          isActive: true,
          ...(productId ? { productId } : {}),
          question: {
            contains: question,
            mode: 'insensitive',
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (matchedQuestion) {
        await prisma.chatbotInteraction.create({
          data: {
            shop,
            productId,
            question,
            answer: matchedQuestion.answer,
            matched: true,
          },
        }).catch(err => console.warn("⚠️ Analytics logging failed:", err));

        return json({
          answer: matchedQuestion.answer,
          nextQuestion: null,
        });
      }

      return json({
        answer: "I don't have specific information about that. Would you like to speak with our support team?",
      });
    }

    return json({ error: "Invalid request format" }, { status: 400 });

  } catch (error) {
    console.error("❌ Error in chat API action:", error);
    return json({ 
      error: "Internal Server Error",
      answer: "Something went wrong. Please try again later."
    }, { status: 500 });
  }
};
