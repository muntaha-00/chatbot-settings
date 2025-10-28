import prisma from "../db.server";
import { json } from "../utils/response.js";

export async function loader({ request }) {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return json({ error: "Missing shop parameter" }, { status: 400 });
    }

    const settings = await prisma.chatbotSettings.findUnique({
      where: { shop },
    });

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
  } catch (error) {
    console.error("❌ Error loading chatbot settings:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}