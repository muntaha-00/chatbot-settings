class ProductChatbot {
  constructor() {
    this.container = document.getElementById("product-chatbot");
    if (!this.container) {
      console.warn("⚠️ Chatbot container not found");
      return;
    }

    // Read product data
    this.productId = this.container.dataset.productId;
    this.productTitle = this.container.dataset.productTitle;
    this.shop = this.container.dataset.shop || window.Shopify?.shop || window.location.hostname;

    if (!this.shop) {
      console.error("❌ Chatbot: Unable to determine shop");
      return;
    }

    // Read Theme Editor customizations
    this.config = {
      position: this.container.dataset.position || 'bottom-right',
      width: parseInt(this.container.dataset.width) || 400,
      height: parseInt(this.container.dataset.height) || 550,
      primaryColor: this.container.dataset.primaryColor || '#007bff',
      textColor: this.container.dataset.textColor || '#ffffff',
      botBg: this.container.dataset.botBg || '#e5e7eb',
      botText: this.container.dataset.botText || '#1f2937',
      borderRadius: parseInt(this.container.dataset.borderRadius) || 12,
      title: this.container.dataset.title || 'Store Assistant',
      welcomeMessage: this.container.dataset.welcome || 'Hi! How can I help you today?',
      placeholder: this.container.dataset.placeholder || 'Ask about this product...',
      sendText: this.container.dataset.sendText || 'Send',
      autoOpen: this.container.dataset.autoOpen === 'true',
      autoDelay: parseInt(this.container.dataset.autoDelay) || 5,
      showMinimize: this.container.dataset.minimize === 'true',
      zIndex: parseInt(this.container.dataset.zIndex) || 9999
    };

    console.log("🤖 Chatbot initialized with config:", this.config);

    this.isTyping = false;
    this.isMinimized = true; // Start minimized
    this.initialize();
  }

  async initialize() {
    await this.loadSettings();
    this.renderChatbot();
    this.addEventListeners();
    
    // Auto-open if enabled
    if (this.config.autoOpen) {
      setTimeout(() => this.toggleMinimize(), this.config.autoDelay * 1000);
    }
  }

  async loadSettings() {
    try {
      const url = `/apps/chatbot/api/settings?shop=${encodeURIComponent(this.shop)}`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      this.settings = await res.json();
      
      // Merge database settings with Theme Editor config
      // Theme Editor takes priority for visual settings
      this.config.title = this.config.title || this.settings.chatbotName;
      this.config.welcomeMessage = this.config.welcomeMessage || this.settings.welcomeMessage;
      this.config.primaryColor = this.config.primaryColor || this.settings.primaryColor;
      
      console.log("✅ Settings loaded and merged");
    } catch (err) {
      console.error("❌ Failed to load settings:", err);
      this.settings = { isActive: true };
    }
  }

  renderChatbot() {
    // Apply positioning
    this.applyPosition();
    
    // Render HTML with customizations
    this.container.innerHTML = `
      <div class="chatbot-trigger ${this.isMinimized ? '' : 'hidden'}" 
           style="background: ${this.config.primaryColor}; z-index: ${this.config.zIndex};">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${this.config.textColor}" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      
      <div class="chatbot-widget ${this.isMinimized ? 'minimized' : ''}" 
           style="width: ${this.config.width}px; height: ${this.config.height}px; border-radius: ${this.config.borderRadius}px; z-index: ${this.config.zIndex};">
        
        <div class="chatbot-header" style="background: ${this.config.primaryColor}; color: ${this.config.textColor}; border-radius: ${this.config.borderRadius}px ${this.config.borderRadius}px 0 0;">
          <div class="chatbot-title">${this.config.title}</div>
          ${this.config.showMinimize ? `
            <button class="minimize-btn" style="color: ${this.config.textColor};" aria-label="Minimize chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          ` : ''}
        </div>
        
        <div class="chat-messages" id="chat-messages"></div>
        
        <form id="chat-form" class="chat-input">
          <input 
            id="chat-input-field" 
            type="text" 
            placeholder="${this.config.placeholder}" 
            autocomplete="off"
            maxlength="500"
          />
          <button type="submit" style="background: ${this.config.primaryColor}; color: ${this.config.textColor};">
            ${this.config.sendText}
          </button>
        </form>
      </div>
    `;

    // Add welcome message
    this.addMessage(this.config.welcomeMessage, "bot");
  }

  applyPosition() {
    const positions = {
      'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' },
      'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
      'top-right': { top: '20px', right: '20px', bottom: 'auto', left: 'auto' },
      'top-left': { top: '20px', left: '20px', bottom: 'auto', right: 'auto' }
    };

    const pos = positions[this.config.position] || positions['bottom-right'];
    Object.assign(this.container.style, {
      position: 'fixed',
      ...pos,
      zIndex: this.config.zIndex
    });
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    
    const trigger = this.container.querySelector('.chatbot-trigger');
    const widget = this.container.querySelector('.chatbot-widget');
    
    if (this.isMinimized) {
      trigger.classList.remove('hidden');
      widget.classList.add('minimized');
    } else {
      trigger.classList.add('hidden');
      widget.classList.remove('minimized');
      // Focus input when opening
      setTimeout(() => {
        this.container.querySelector('#chat-input-field')?.focus();
      }, 300);
    }
  }

  addMessage(text, sender = "bot") {
    const messages = document.getElementById("chat-messages");
    if (!messages) return;

    const row = document.createElement("div");
    row.className = `chat-row ${sender === "user" ? "user" : "bot"}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${sender === "user" ? "user-avatar" : "bot-avatar"}`;
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = sender === "user" ? ProductChatbot.userSVG() : ProductChatbot.botSVG();

    const bubble = document.createElement("div");
    bubble.className = `message ${sender === "user" ? "message-user" : "message-bot"}`;
    
    // Apply custom colors to bot messages
    if (sender === "bot") {
      bubble.style.background = this.config.botBg;
      bubble.style.color = this.config.botText;
    }
    
    if (sender === "bot-typing") {
      bubble.className = "message message-bot typing-indicator";
      bubble.style.background = this.config.botBg;
      bubble.innerHTML = '<span></span><span></span><span></span>';
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
    // Trigger button
    const trigger = this.container.querySelector('.chatbot-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => this.toggleMinimize());
    }

    // Minimize button
    const minimizeBtn = this.container.querySelector('.minimize-btn');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => this.toggleMinimize());
    }

    // Form submission
    const form = document.getElementById("chat-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleUserMessage();
      });
    }
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

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const answer = data?.answer || "Sorry, I don't have an answer for that right now.";
      
      this.addMessage(answer, "bot");

      if (data?.nextQuestion) {
        setTimeout(() => this.addMessage(data.nextQuestion, "bot"), 1000);
      }
    } catch (err) {
      console.error("❌ Chat error:", err);
      this.removeTypingIndicator();
      this.addMessage("Sorry, something went wrong. Please try again later.", "bot");
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