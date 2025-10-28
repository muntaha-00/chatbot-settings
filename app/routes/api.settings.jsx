import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response.js";

export async function loader({ request }) {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;

    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.chatbotSettings.findUnique({
      where: { shop },
    });

    return json({ settings: settings || null });
  } catch (error) {
    console.error("❌ Error loading settings:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function action({ request }) {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;

    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    
    const chatbotName = String(formData.get("chatbotName") || "").trim();
    const welcomeMessage = String(formData.get("welcomeMessage") || "").trim();
    const primaryColor = String(formData.get("primaryColor") || "#007bff").trim();
    const position = String(formData.get("position") || "bottom-right").trim();
    
    const isActiveRaw = formData.get("isActive");
    
    let isActive;
    if (isActiveRaw === "on" || isActiveRaw === "true" || isActiveRaw === true) {
      isActive = true;
    } else if (isActiveRaw === "off" || isActiveRaw === "false" || isActiveRaw === false || isActiveRaw === null) {
      isActive = false;
    } else {
      isActive = true;
    }

    if (!chatbotName) {
      return json({ 
        success: false,
        error: "Chatbot name is required" 
      }, { status: 400 });
    }

    if (!welcomeMessage) {
      return json({ 
        success: false,
        error: "Welcome message is required" 
      }, { status: 400 });
    }

    if (typeof isActive !== 'boolean') {
      isActive = true;
    }

    const settingsData = {
      chatbotName,
      welcomeMessage,
      primaryColor,
      position,
      isActive: Boolean(isActive),
    };

    const settings = await prisma.chatbotSettings.upsert({
      where: { shop },
      update: settingsData,
      create: {
        shop,
        ...settingsData,
      },
    });

    return json({ 
      success: true, 
      settings,
      message: "Settings saved successfully" 
    });

  } catch (error) {
    console.error("❌ ERROR SAVING SETTINGS:", error.message);
    
    return json({ 
      success: false,
      error: `Failed to save settings: ${error.message}` 
    }, { status: 500 });
  }
}

export default function SettingsPage() {
  const { settings: loadedSettings } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [chatbotName, setChatbotName] = useState(
    loadedSettings?.chatbotName || "Store Assistant"
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    loadedSettings?.welcomeMessage || "Hi! How can I help you today?"
  );
  const [primaryColor, setPrimaryColor] = useState(
    loadedSettings?.primaryColor || "#007bff"
  );
  const [position, setPosition] = useState(
    loadedSettings?.position || "bottom-right"
  );
  const [isActive, setIsActive] = useState(
    loadedSettings?.isActive !== undefined ? loadedSettings.isActive : true
  );

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setSaved(true);
      setError("");
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    } else if (fetcher.data?.error) {
      setError(fetcher.data.error);
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data]);

  const handleSave = () => {
    const formData = new FormData();
    formData.append("chatbotName", chatbotName);
    formData.append("welcomeMessage", welcomeMessage);
    formData.append("primaryColor", primaryColor);
    formData.append("position", position);
    
    if (isActive) {
      formData.append("isActive", "on");
    }

    fetcher.submit(formData, { method: "post" });
  };

  return (
    <s-page title="Chatbot Settings">
      <s-section spacing="loose">
        <s-button onClick={() => navigate("/app")} variant="secondary">
          ← Back to Home
        </s-button>
      </s-section>

      <s-card title="Chatbot Configuration" sectioned>
        <s-stack direction="vertical" gap="base">
          {error && (
            <div style={{ padding: 12, background: "#fee", color: "#c00", borderRadius: 8, marginBottom: 12 }}>
              ❌ {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Chatbot Name
            </label>
            <input
              type="text"
              value={chatbotName}
              onChange={(e) => setChatbotName(e.target.value)}
              placeholder="e.g., Store Assistant"
              maxLength={50}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Welcome Message
            </label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="e.g., Hi! How can I help you today?"
              rows={3}
              maxLength={200}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Primary Color
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 60, height: 40 }}
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#007bff"
                style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Position
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
            </select>
          </div>

          <div style={{ padding: 16, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: 20, height: 20, cursor: "pointer" }}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: 16 }}>Enable Chatbot</span>
                <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0 0" }}>
                  {isActive ? "✅ Chatbot is visible on storefront" : "⚠️ Chatbot is hidden from storefront"}
                </p>
              </div>
            </label>
          </div>

          <s-stack direction="horizontal" gap="base" alignment="center" style={{ marginTop: 16 }}>
            <s-button variant="primary" onClick={handleSave} disabled={fetcher.state === "submitting"}>
              {fetcher.state === "submitting" ? "Saving..." : "Save Settings"}
            </s-button>
            {saved && (
              <s-text style={{ color: "green", marginLeft: 12 }}>
                ✓ Settings saved successfully!
              </s-text>
            )}
          </s-stack>
        </s-stack>
      </s-card>
    </s-page>
  );
}