import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Helper to return JSON responses
function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

// Loader — Load settings for this shop
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request); // ✅ get current shop session
  const shop = session?.shop;
  if (!shop) return new Response("Shop not found", { status: 400 });

  // Fetch settings specific to this shop
  const settings = await prisma.chatbotSettings.findFirst({
    where: { shop },
  });

  return json({ settings });
};

// Action — Save settings for this shop
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) return new Response("Shop not found", { status: 400 });

  const data = await request.formData();
  const botName = data.get("botName") || "ShopBot";
  const model = data.get("model") || "openai";

  // Upsert settings
  const existing = await prisma.chatbotSettings.findFirst({ where: { shop } });

  if (existing) {
    await prisma.chatbotSettings.update({
      where: { id: existing.id },
      data: { botName, model },
    });
  } else {
    await prisma.chatbotSettings.create({
      data: { shop, botName, model },
    });
  }

  return json({ success: true });
};

// Component
export default function SettingsPage() {
  const { settings } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [model, setModel] = useState(settings?.model || "openai");
  const [botName, setBotName] = useState(settings?.botName || "ShopBot");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const formData = new FormData();
    formData.append("botName", botName);
    formData.append("model", model);
    fetcher.submit(formData, { method: "post" });
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      setSaved(true);
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data]);

  return (
    <s-page heading="AI Chatbot Settings">
      <s-section spacing="loose">
        <s-button onClick={() => navigate("/app")} variant="secondary">
          ← Back to Home
        </s-button>
      </s-section>

      <s-section spacing="loose">
        <s-card padding="base">
          <s-text variant="headingMd">Select AI Model</s-text>
          <div style={{ maxWidth: "400px", marginTop: "8px" }}>
            <label
              htmlFor="ai-model"
              style={{ display: "block", marginBottom: "6px" }}
            >
              Choose your AI provider:
            </label>
            <select
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: "100%",
                height: "40px",
                borderRadius: "6px",
                padding: "8px",
                border: "1px solid #ccc",
              }}
            >
              <option value="openai">OpenAI GPT</option>
              <option value="claude">Anthropic Claude</option>
              <option value="deepseek">DeepSeek</option>
              <option value="custom">Custom Recommendation AI</option>
            </select>
          </div>
        </s-card>
      </s-section>

      <s-section spacing="loose">
        <s-card padding="base">
          <s-stack direction="vertical" gap="base">
            <s-text variant="headingMd">Change Your Chatbot Name</s-text>
            <s-text-field
              value={botName}
              onInput={(e) => setBotName(e.target.value)}
              placeholder="Enter chatbot name"
            />
          </s-stack>
        </s-card>
      </s-section>

      <s-section spacing="loose">
        <s-stack alignment="center" style={{ marginTop: "12px" }}>
          <s-button variant="primary" onClick={handleSave}>
            Save Settings
          </s-button>

          {saved && (
            <s-text style={{ color: "green", marginLeft: "12px" }}>
              Settings saved successfully!
            </s-text>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}
