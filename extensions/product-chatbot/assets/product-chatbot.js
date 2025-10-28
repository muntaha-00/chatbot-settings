class ProductChatbot {
  constructor() {
    this.container = document.getElementById("product-chatbot");
    if (!this.container) return;

    this.productId = this.container.dataset.productId;
    this.productTitle = this.container.dataset.productTitle;
    this.shop =
      this.container.dataset.shop ||
      window.Shopify?.shop ||
      window.location.hostname;

    if (!this.shop) {
      console.error("❌ Chatbot: Unable to determine shop");
      return;
    }

    this.isTyping = false;
    this.initialize();
  }

  async initialize() {
    await this.loadSettings();
    
    if (this.settings?.isActive) {
      this.renderChatbot();
      this.addEventListeners();
    } else {
      console.info("ℹ️ Chatbot is not active for this shop");
    }
  }

  async loadSettings() {
    try {
      const res = await fetch(
        `/apps/chatbot/api/settings?shop=${encodeURIComponent(this.shop)}`
      );
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      this.settings = await res.json();
    } catch (err) {
      console.warn("⚠️ Using default chatbot settings:", err);
      this.settings = {
        chatbotName: "Store Assistant",
        welcomeMessage: "Hi! How can I help you today?",
        primaryColor: "#007bff",
        isActive: true,
      };
    }
  }

  renderChatbot() {
    this.container.innerHTML = `
      <div class="chatbot-widget" role="region" aria-label="Product chatbot">
        <div class="chatbot-header" style="background:${this.settings.primaryColor}">
          <div class="chatbot-title">${this.settings.chatbotName}</div>
        </div>

        <div class="chat-messages" id="chat-messages" aria-live="polite"></div>

        <form id="chat-form" class="chat-input" aria-label="Send a message">
          <input 
            id="chat-input-field" 
            type="text" 
            placeholder="Ask about this product..." 
            autocomplete="off"
            maxlength="500"
          />
          <button id="send-message" type="submit" aria-label="Send message">
            Send
          </button>
        </form>
      </div>
    `;

    this.addMessage(this.settings.welcomeMessage, "bot");
  }

  addMessage(text, sender = "bot") {
    const messages = document.getElementById("chat-messages");
    if (!messages) return;

    const row = document.createElement("div");
    row.className = `chat-row ${sender === "user" ? "user" : "bot"}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${sender === "user" ? "user-avatar" : "bot-avatar"}`;
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML =
      sender === "user" ? ProductChatbot.userSVG() : ProductChatbot.botSVG();

    const bubble = document.createElement("div");
    bubble.className = `message ${
      sender === "user" ? "message-user" : "message-bot"
    }`;
    
    if (sender === "bot-typing") {
      bubble.className = "message message-bot typing-indicator";
      bubble.innerHTML = '<span></span><span></span><span></span>';
      bubble.setAttribute("aria-label", "Bot is typing");
    } else {
      bubble.textContent = text;
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;

    return row;
  }

  removeTypingIndicator() {
    const messages = document.getElementById("chat-messages");
    const typing = messages?.querySelector(".typing-indicator");
    if (typing) {
      typing.closest(".chat-row").remove();
    }
  }

  addEventListeners() {
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input-field");

    if (!form || !input) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleUserMessage();
    });
  }

  async handleUserMessage() {
    if (this.isTyping) return;

    const input = document.getElementById("chat-input-field");
    const message = input.value.trim();
    
    if (!message) return;

    this.addMessage(message, "user");
    input.value = "";
    
    this.isTyping = true;
    this.addMessage("", "bot-typing");

    try {
      const res = await fetch("/apps/chatbot/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: this.shop,
          productId: this.productId,
          productTitle: this.productTitle,
          question: message,
        }),
      });

      this.removeTypingIndicator();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const answer = data?.answer || "Sorry, I don't have an answer for that right now.";
      
      this.addMessage(answer, "bot");

      if (data?.nextQuestion) {
        setTimeout(() => {
          this.addMessage(data.nextQuestion, "bot");
        }, 1000);
      }

    } catch (err) {
      console.error("❌ Chat error:", err);
      this.removeTypingIndicator();
      this.addMessage(
        "Sorry, something went wrong. Please try again later.",
        "bot"
      );
    } finally {
      this.isTyping = false;
    }
  }

  static botSVG() {
    return `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#E6F0FF"/>
        <path d="M8 13h8" stroke="#1D4ED8" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M8 9h.01" stroke="#1D4ED8" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M16 9h.01" stroke="#1D4ED8" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
  }

  static userSVG() {
    return `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#FFF1F0"/>
        <path d="M12 11a3 3 0 100-6 3 3 0 000 6z" fill="#EF4444"/>
        <path d="M5 19a7 7 0 0114 0" stroke="#EF4444" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new ProductChatbot();
  });
} else {
  new ProductChatbot();
}
