document.addEventListener('DOMContentLoaded', () => {
    // Chat.js - Gestore della chat con integrazione avatar e visualizzazione premium

    function getApiKey() {
      return (localStorage.getItem("chat_api_key") || localStorage.getItem("gemini_api_key") || "").trim();
    }

    function getChatEndpoint() {
      let endpoint = (localStorage.getItem("chat_endpoint") || "").trim();
      const apiKey = getApiKey();

      if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
        const provider = localStorage.getItem("chat_provider");
        const defaultEndpoints = {
          openai: "https://api.openai.com/v1",
          gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
          deepseek: "https://api.deepseek.com",
          openrouter: "https://openrouter.ai/api/v1",
          groq: "https://api.groq.com/openai/v1",
          ollama: "http://localhost:11434/v1"
        };
        if (provider && defaultEndpoints[provider]) {
          endpoint = defaultEndpoints[provider];
        } else if (apiKey.startsWith("AIzaSy")) {
          endpoint = "https://generativelanguage.googleapis.com/v1beta/openai";
        } else {
          endpoint = "https://api.openai.com/v1";
        }
      }

      endpoint = endpoint.replace(/\/+$/, '');
      if (endpoint === 'https://api.openai.com') {
        endpoint = 'https://api.openai.com/v1';
      }
      if (!endpoint.endsWith('/chat/completions') && !endpoint.includes(':generateContent')) {
        endpoint += '/chat/completions';
      }
      return endpoint;
    }

    function getChatModel() {
      let custom = (localStorage.getItem("chat_model") || "").trim();
      if (custom === "gemini-2.5-flash") {
        custom = "gemini-1.5-flash";
        try { localStorage.setItem("chat_model", "gemini-1.5-flash"); } catch (e) {}
      }
      if (custom) {
        return custom;
      }

      const provider = localStorage.getItem("chat_provider");
      const defaultModels = {
        openai: "gpt-4o-mini",
        gemini: "gemini-1.5-flash",
        deepseek: "deepseek-chat",
        openrouter: "deepseek/deepseek-r1:free",
        groq: "llama-3.3-70b-versatile",
        ollama: "llama3"
      };
      if (provider && defaultModels[provider]) {
        return defaultModels[provider];
      }

      const endpoint = getChatEndpoint();
      if (endpoint.includes("generativelanguage.googleapis.com")) {
        return "gemini-1.5-flash";
      }
      return "gpt-4o-mini";
    }

    function getMessageText(item) {
      if (!item) return '';
      if (typeof item.content === 'string') return item.content;
      if (Array.isArray(item.parts) && item.parts[0]?.text) return item.parts[0].text;
      return '';
    }

    const messagesContainer = document.getElementById("ai-chat-messages");
    const inputField = document.getElementById("ai-chat-input");
    const sendButton = document.getElementById("ai-chat-send-btn") || document.querySelector(".ai-chat-button");

    let chatHistory = [];
    try {
      const storedHistory = localStorage.getItem("chat_history");
      if (storedHistory) {
        chatHistory = JSON.parse(storedHistory) || [];
        if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);
      }
    } catch (e) {
      chatHistory = [];
    }

    function saveChatHistory() {
      try {
        if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);
        localStorage.setItem("chat_history", JSON.stringify(chatHistory));
      } catch (e) {
        try {
          chatHistory = chatHistory.slice(-20);
          localStorage.setItem("chat_history", JSON.stringify(chatHistory));
        } catch (e2) {}
      }
    }

    function getProfileName() {
      return (localStorage.getItem("profile_name") || "Lorenzo").trim() || "Lorenzo";
    }

    function getSystemInstruction() {
      const name = getProfileName();
      return `Sei un assistente AI. L'utente si chiama ${name} e vuole risposte brevi.`;
    }

    function renderMarkdownSafe(text) {
      try {
        if (window.marked && window.AppSanitize) {
          return window.AppSanitize.sanitizeMarkdownHtml(window.marked.parse(text || ""));
        }
      } catch (e) {}
      return null;
    }

    function extractAiText(data) {
      if (!data) return null;

      // 1. Array wrapper (es. Hugging Face TGI / proxy multi-scelta)
      if (Array.isArray(data)) {
        if (data.length === 0) return null;
        if (typeof data[0] === 'string') return data.join('\n');
        if (data[0]?.generated_text) return data[0].generated_text;
        if (data[0]?.choices) return extractAiText(data[0]);
      }

      // 2. Errore API restituito dentro una risposta 200 OK
      if (data.error) {
        if (typeof data.error === 'string') return `Errore API: ${data.error}`;
        if (typeof data.error.message === 'string') return `Errore API: ${data.error.message}`;
      }

      // 3. Formato standard OpenAI choices
      if (Array.isArray(data.choices) && data.choices.length > 0) {
        const choice = data.choices[0];
        const msg = choice.message;
        if (msg) {
          if (typeof msg.content === 'string' && msg.content.trim()) {
            return msg.content;
          }
          if (Array.isArray(msg.content)) {
            const joined = msg.content
              .map(part => (typeof part === 'string' ? part : (part?.text || '')))
              .filter(Boolean)
              .join('\n');
            if (joined.trim()) return joined;
          }
          if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
            return msg.reasoning_content;
          }
          if (typeof msg.refusal === 'string' && msg.refusal.trim()) {
            return `Rifiuto del modello: ${msg.refusal}`;
          }
        }
        if (typeof choice.delta?.content === 'string' && choice.delta.content.trim()) {
          return choice.delta.content;
        }
        if (typeof choice.text === 'string' && choice.text.trim()) {
          return choice.text;
        }
        if (choice.finish_reason && choice.finish_reason !== 'stop') {
          return `Risposta interrotta (${choice.finish_reason}).`;
        }
      }

      // 4. Formato nativo Google Gemini candidates
      if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        const parts = candidate.content?.parts;
        if (Array.isArray(parts)) {
          const text = parts.map(p => p.text || '').filter(Boolean).join('\n');
          if (text.trim()) return text;
        }
        if (typeof candidate.output === 'string' && candidate.output.trim()) {
          return candidate.output;
        }
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
          return `Risposta interrotta da Gemini (${candidate.finishReason}).`;
        }
      }

      // 5. Formato nativo Ollama (/api/chat)
      if (data.message && typeof data.message.content === 'string' && data.message.content.trim()) {
        return data.message.content;
      }

      // 6. Formato nativo Ollama (/api/generate)
      if (typeof data.response === 'string' && data.response.trim()) {
        return data.response;
      }

      // 7. Formato nativo Anthropic Claude (/v1/messages)
      if (Array.isArray(data.content)) {
        const text = data.content
          .map(b => (typeof b === 'string' ? b : (b?.text || '')))
          .filter(Boolean)
          .join('\n');
        if (text.trim()) return text;
      }

      // 8. Campi testo diretti
      if (typeof data.text === 'string' && data.text.trim()) return data.text;
      if (typeof data.output === 'string' && data.output.trim()) return data.output;
      if (typeof data.result === 'string' && data.result.trim()) return data.result;
      if (typeof data.answer === 'string' && data.answer.trim()) return data.answer;

      try {
        const keys = Object.keys(data);
        if (keys.length > 0) {
          console.warn("[Chat] Risposta in formato non previsto:", data);
          return `Risposta ricevuta in formato non riconosciuto: ${JSON.stringify(data).slice(0, 300)}`;
        }
      } catch (e) {}

      return null;
    }

    function addAiChatMessage(content, sender, isMarkdown = false) {
      if (!messagesContainer) return;
      const wrapper = document.createElement("div");
      wrapper.className = `ai-chat-message-wrapper ai-chat-${sender}-wrapper`;

      const avatar = document.createElement("div");
      avatar.className = `ai-chat-avatar ai-chat-${sender}-avatar`;
      if (sender === "ai") {
        avatar.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2L14.7 8.3L21 9.6L16.2 14L17.7 20.5L12 17L6.3 20.5L7.8 14L3 9.6L9.3 8.3L12 2Z"></path></svg>`;
      } else {
        const nm = getProfileName();
        avatar.textContent = (nm.charAt(0) || "U").toUpperCase();
      }

      const bubble = document.createElement("div");
      bubble.className = `ai-chat-message-bubble ai-chat-${sender}-bubble`;
      if (isMarkdown) {
        const safe = renderMarkdownSafe(content);
        if (safe !== null) bubble.innerHTML = safe;
        else bubble.textContent = content;
      } else {
        bubble.textContent = content;
      }

      wrapper.appendChild(avatar);
      wrapper.appendChild(bubble);
      messagesContainer.appendChild(wrapper);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    if (chatHistory.length > 0) {
      chatHistory.forEach(item => {
        const sender = (item.role === "user") ? "user" : "ai";
        const text = getMessageText(item);
        if (text && text !== "(nessuna risposta)" && !text.startsWith("⚠️")) {
          addAiChatMessage(text, sender, sender === "ai");
        }
      });
    } else if (!getApiKey() && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(getChatEndpoint())) {
      addAiChatMessage("⚠️ Configura la tua API Key nelle impostazioni (⚙️) per iniziare a chattare.", "ai");
    } else {
      addAiChatMessage(`Ciao ${getProfileName()}! Come posso aiutarti oggi? 💫`, "ai");
    }

    // Indicatore versione (per verificare che l'estensione sia aggiornata)
    const chatHeader = document.querySelector('.ai-chat-header-title');
    if (chatHeader) {
      chatHeader.title = 'Custom New Tab v1.1.1';
    }

    let isSending = false;

    async function sendAiChatMessage() {
      if (!inputField || !messagesContainer || isSending) return;
      const text = inputField.value.trim();
      if (!text) return;

      const endpoint = getChatEndpoint();
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(endpoint);
      const apiKey = getApiKey();
      if (!apiKey && !isLocalhost) {
        addAiChatMessage("⚠️ Impossibile inviare. Configura prima la tua API Key nelle impostazioni (⚙️).", "ai");
        return;
      }

      isSending = true;
      addAiChatMessage(text, "user");
      inputField.value = "";

      chatHistory.push({ role: "user", content: text });
      saveChatHistory();

      const loadingWrapper = document.createElement("div");
      loadingWrapper.className = "ai-chat-message-wrapper ai-chat-ai-wrapper";

      const avatar = document.createElement("div");
      avatar.className = "ai-chat-avatar ai-chat-ai-avatar";
      avatar.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2L14.7 8.3L21 9.6L16.2 14L17.7 20.5L12 17L6.3 20.5L7.8 14L3 9.6L9.3 8.3L12 2Z"></path></svg>`;

      const bubble = document.createElement("div");
      bubble.className = "ai-chat-message-bubble ai-chat-ai-bubble";
      bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

      loadingWrapper.appendChild(avatar);
      loadingWrapper.appendChild(bubble);
      messagesContainer.appendChild(loadingWrapper);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        const model = getChatModel();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const messages = [
          { role: "system", content: getSystemInstruction() },
          ...chatHistory
            .filter(m => {
              const txt = getMessageText(m);
              return txt && txt !== "(nessuna risposta)" && !txt.startsWith("⚠️") && !txt.startsWith("Errore");
            })
            .slice(-40)
            .map(m => ({
              role: (m.role === "model" || m.role === "ai" || m.role === "assistant") ? "assistant" : "user",
              content: getMessageText(m)
            }))
        ];

        const headers = {
          "Content-Type": "application/json"
        };
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
          if (apiKey.startsWith("AIzaSy") || endpoint.includes("googleapis.com")) {
            headers["x-goog-api-key"] = apiKey;
          }
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            model: model,
            messages: messages
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorData = null;
          try {
            errorData = await response.json();
          } catch (e) {
            try {
              errorData = { message: await response.text() };
            } catch (e2) {}
          }
          let errMsg = `Errore HTTP ${response.status}`;
          if (errorData) {
            if (typeof errorData.error === 'string') errMsg = errorData.error;
            else if (typeof errorData.error?.message === 'string') errMsg = errorData.error.message;
            else if (typeof errorData.message === 'string') errMsg = errorData.message;
          }
          throw new Error(errMsg);
        }

        const data = await response.json();
        const extracted = extractAiText(data);
        const aiText = extracted || "⚠️ Nessun contenuto valido restituito dal modello. Verifica che l'API Key, il Modello e l'Endpoint selezionati nelle impostazioni (⚙️) siano corretti.";

        const safe = renderMarkdownSafe(aiText);
        if (safe !== null) bubble.innerHTML = safe;
        else bubble.textContent = aiText;

        if (extracted) {
          chatHistory.push({ role: "assistant", content: aiText });
          saveChatHistory();
        }
      } catch (error) {
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === "user") {
          chatHistory.pop();
          saveChatHistory();
        }
        bubble.textContent = "Errore: " + (error.name === 'AbortError' ? 'timeout, riprova' : error.message);
      } finally {
        isSending = false;
      }
    }

    // Espone sendAiChatMessage globalmente per compatibilità (nessun onclick inline in HTML)
    window.sendAiChatMessage = sendAiChatMessage;

    // Eventi: invio con click e con Enter
    if (sendButton) {
        sendButton.addEventListener("click", sendAiChatMessage);
    }

    if (inputField) {
        inputField.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                sendAiChatMessage();
            }
        });
    }
});
