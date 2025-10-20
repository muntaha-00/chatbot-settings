// app/api/chat.jsx
import { prisma } from "../db.server";

// Helper to return JSON response
function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

// Chatbot API endpoint
export async function action({ request }) {
  try {
    const body = await request.json();
    const { message, productId, productTitle, customerName, shop } = body;

    if (!message) {
      return json({ error: "Missing message" }, { status: 400 });
    }

    // Optional: get chatbot settings for this shop
    const setting = shop
      ? await prisma.chatbotSettings.findFirst({ where: { shop } })
      : null;

    // Example reply logic (you can replace with AI later)
    let reply = "Sorry, I didn’t understand that.";

    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("price")) {
      reply = `The price of "${productTitle || "this product"}" depends on customization options.`;
    } else if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
      reply = `Hi ${customerName || "there"}! How can I help you with ${productTitle || "this product"} today?`;
    }

    // Save conversation (optional)
    await prisma.chatbotQuestion.create({
      data: {
        question: message,
        answer: reply,
        productId: productId || null,
        productTitle: productTitle || null,
        customerName: customerName || "Guest",
        shop: shop || "unknown",
      },
    });

    return json({ reply });
  } catch (error) {
    console.error("Chatbot API error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
