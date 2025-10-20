class ProductChatbot {
  constructor() {
    this.container = document.getElementById('product-chatbot');
    if (!this.container) return;

    this.productId = this.container.dataset.productId;
    this.productTitle = this.container.dataset.productTitle;
    this.customer = this.container.dataset.shopifyCustomer;

    this.initializeChatbot();
  }

  initializeChatbot() {
    this.container.innerHTML = `
      <div class="product-chatbot">
        <div class="chat-messages" id="chat-messages"></div>
        <form id="chat-form">
          <input type="text" placeholder="Type a message..." id="chat-input">
          <button type="submit">Send</button>
        </form>
      </div>
    `;

    this.addEventListeners();
    this.addWelcomeMessage();
  }

  addEventListeners() {
    const form = document.getElementById('chat-form');
    form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  addWelcomeMessage() {
    const message = "Hi! How can I help you with this product?";
    this.addMessage(message, 'bot');
  }

  addMessage(text, sender) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `message-${sender}`);
    messageElement.textContent = text;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;

    this.addMessage(message, 'user');
    input.value = '';

    // Add your chatbot logic here
    // For now, just echo back
    setTimeout(() => {
      this.addMessage(`You asked about: ${message}`, 'bot');
    }, 1000);
  }
}

// Initialize the chatbot when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProductChatbot();
});