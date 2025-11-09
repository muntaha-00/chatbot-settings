import { json } from "../utils/response.js";
import prisma from "../db.server";

export async function loader({ request, params }) {
  const path = params["*"];
  
  console.log(" Proxy GET request:", path);
  
  if (path === "api/settings") {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    
    console.log("  Requested shop:", shop);

    if (!shop) {
      return json({ error: "Missing shop parameter" }, { status: 400 });
    }

    const settings = await prisma.chatbotSettings.findUnique({
      where: { shop },
    });

    console.log("  Found settings:", !!settings);

    if (settings) {
      return json(settings);
    } else {
      return json({
        chatbotName: "Store Assistant",
        welcomeMessage: "Hi! How can I help you today?",
        primaryColor: "#007bff",
        position: "bottom-right",
        isActive: false,
      });
    }
  }
  
  return json({ error: "Not found" }, { status: 404 });
}

export async function action({ request, params }) {
  const path = params["*"];
  
  console.log("\n========== PROXY POST ==========");
  console.log("Path:", path);
  
  if (path === "api/chat") {
    try {
      const data = await request.json();
      console.log("Received data:", JSON.stringify(data, null, 2));
      
      const { shop, question, productId } = data;

      if (!shop || !question) {
        console.log(" Missing parameters");
        return json({ 
          answer: "Missing required information."
        }, { status: 400 });
      }

      console.log("\n1. Checking shop settings...");
      const shopSettings = await prisma.chatbotSettings.findUnique({
        where: { shop },
      });
      console.log("   Settings found:", !!shopSettings);
      console.log("   Is active:", shopSettings?.isActive);

      if (!shopSettings || !shopSettings.isActive) {
        console.log(" Shop not active or not found");
        return json({ 
          answer: "This chatbot is currently unavailable.",
        });
      }

      console.log("\n2. Searching for question match...");
      console.log("   Shop:", shop);
      console.log("   Customer question:", question);
      console.log("   Product ID:", productId || "none");
      
      // Get ALL active questions for this shop
      // First try product-specific questions, then fall back to general questions
      let allQuestions = [];
      
      if (productId) {
        // Try to find product-specific questions first
        const productQuestions = await prisma.chatbotQuestion.findMany({
          where: {
            shop,
            isActive: true,
            productId: productId,
          },
          orderBy: { createdAt: "desc" },
        });
        
        allQuestions = productQuestions;
        console.log("   Product-specific questions:", productQuestions.length);
      }
      
      // If no product-specific questions, get general questions (productId = null)
      if (allQuestions.length === 0) {
        const generalQuestions = await prisma.chatbotQuestion.findMany({
          where: {
            shop,
            isActive: true,
            productId: null, // General questions for all products
          },
          orderBy: { createdAt: "desc" },
        });
        
        allQuestions = generalQuestions;
        console.log("   General questions:", generalQuestions.length);
      }
      
      console.log("   Total questions in DB:", allQuestions.length);

      // Manual matching with case-insensitive keyword search
      const customerQuestionLower = question.toLowerCase().trim();
      
      // Extract keywords (words longer than 2 characters)
      const keywords = customerQuestionLower
        .split(/\s+/)
        .filter(word => word.length > 2)
        .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word));
      
      console.log("   Extracted keywords:", keywords);
      
      let bestMatch = null;
      let bestScore = 0;
      
      for (const q of allQuestions) {
        const savedQuestionLower = q.question.toLowerCase();
        
        // Count how many keywords match
        let score = 0;
        for (const keyword of keywords) {
          if (savedQuestionLower.includes(keyword)) {
            score++;
          }
        }
        
        // Exact match bonus
        if (savedQuestionLower === customerQuestionLower) {
          score += 100;
        }
        
        // Substring match bonus
        if (savedQuestionLower.includes(customerQuestionLower) || customerQuestionLower.includes(savedQuestionLower)) {
          score += 50;
        }
        
        console.log(`   Comparing with: "${q.question}" - Score: ${score}`);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = q;
        }
      }
      
      console.log("   Best match score:", bestScore);
      
      // Require at least 1 keyword match
      if (bestMatch && bestScore > 0) {
        console.log("   Matched question:", bestMatch.question);
        console.log("   Answer:", bestMatch.answer);
        console.log("\n Returning matched answer");
        console.log("=================================\n");
        
        return json({
          answer: bestMatch.answer,
          nextQuestion: null,
        });
      }

      console.log("\n No match found - returning default");
      console.log("=================================\n");
      
      return json({
        answer: "I don't have specific information about that. Would you like to speak with our support team?",
      });

    } catch (error) {
      console.error("\n PROXY CHAT ERROR:");
      console.error("Error type:", error.constructor.name);
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
      console.log("=================================\n");
      
      return json({ 
        answer: "Something went wrong. Please try again later."
      }, { status: 500 });
    }
  }
  
  console.log(" Unknown path:", path);
  return json({ error: "Not found" }, { status: 404 });
}