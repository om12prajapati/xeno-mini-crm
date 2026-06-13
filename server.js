const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai'); // Kept if needed elsewhere
const { GoogleGenAI: LegacyAI } = require('@google/generative-ai'); // Safe alternate import
const customers = require('./dataset.json');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// =========================================================================
// IMPORTANT: Paste your direct AIzaSy... key inside the single quotes below!
// =========================================================================
const MY_FALLBACK_KEY = 'AQ.Ab8RN6Kwczsk8QhAvQuJp_GCH6ubJJwew8bd-woovxEfpG1eRQ'; 

const apiKey = process.env.GEMINI_API_KEY || MY_FALLBACK_KEY;

// Fallback initialization check to prevent auth wrapper mismatch crashes
let aiInstance;
try {
  // Try initializing with the new SDK style wrapper
  aiInstance = new GoogleGenAI({ apiKey: apiKey });
} catch (e) {
  // Absolute backup initialization using raw configuration strings
  aiInstance = { models: { generateContent: async (opts) => {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: opts.model || "gemini-1.5-flash" });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: opts.contents + "\n" + opts.config.systemInstruction }] }]
    });
    return { text: result.response.text() };
  }}};
}

let campaignStats = { totalSent: 0, delivered: 0, opened: 0, failed: 0 };

app.get('/api/stats', (req, res) => res.json(campaignStats));
app.get('/api/customers', (req, res) => res.json(customers));

app.post('/api/campaigns/send', async (req, res) => {
  const { prompt, channel } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt." });

  try {
    const systemInstruction = `
      You are a database query condition generator. 
      Output ONLY a raw JavaScript filter condition where 'c' represents a customer object.
      Properties on 'c': c.lastOrderDaysAgo (number), c.orders (number), c.totalSpent (number), c.preferredCategory (string).
      Rules: No backticks, no 'javascript' blocks, no markdown quotes.
      Example Input: "ordered over 90 days ago"
      Example Output: c.lastOrderDaysAgo > 90
    `;

    // Uses a stable configuration interface mapping
    const response = await aiInstance.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: { systemInstruction: systemInstruction, temperature: 0.1 }
    });

    const filterCondition = response.text.replace(/```javascript|```/g, '').trim();
    console.log(`[AI LOG] Condition Evaluated: ${filterCondition}`);

    const evaluationFunction = new Function('c', `return ${filterCondition};`);
    const targetCustomers = customers.filter(c => {
      try { return evaluationFunction(c); } catch { return false; }
    });

    const recipientCount = targetCustomers.length;
    if (recipientCount === 0) {
      return res.json({ message: `Condition "${filterCondition}" found 0 matching customers.` });
    }

    campaignStats.totalSent += recipientCount;

    targetCustomers.forEach(customer => {
      setTimeout(() => {
        const isDelivered = Math.random() > 0.15;
        if (isDelivered) {
          campaignStats.delivered += 1;
          setTimeout(() => {
            if (Math.random() > 0.4) campaignStats.opened += 1;
          }, 1000);
        } else {
          campaignStats.failed += 1;
        }
      }, 1000);
    });

    return res.json({ message: `AI Filtered successfully: "${filterCondition}". Sent to ${recipientCount} customers.` });

  } catch (error) {
    console.error("AI Generation Error Detailed:", error);
    return res.status(500).json({ error: "Failed to process request with AI layer.", details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));