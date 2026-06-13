const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Secure HTTP runner
const customers = require('./dataset.json');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// =========================================================================
// PASTE YOUR ACTUAL GEMINI API KEY INSIDE THE SINGLE QUOTES BELOW!
// =========================================================================
const MY_HARDCODED_KEY = 'AQ.Ab8RN6Kwczsk8QhAvQuJp_GCH6ubJJwew8bd-woovxEfpG1eRQ';

const apiKey = process.env.GEMINI_API_KEY || MY_HARDCODED_KEY;

let campaignStats = {
  totalSent: 0,
  delivered: 0,
  opened: 0,
  failed: 0
};

app.get('/api/stats', (req, res) => res.json(campaignStats));
app.get('/api/customers', (req, res) => res.json(customers));

// Endpoint 3: Connects straight to the raw Google REST endpoint bypassing client SDKs
app.post('/api/campaigns/send', async (req, res) => {
  const { prompt, channel } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing campaign segmentation prompt." });
  }

  try {
    console.log(`[HTTP REST API] Handshaking directly with Google for prompt: "${prompt}"`);

    const systemInstruction = `
      You are an expert database engine assistant. 
      Your single task is to translate natural language user segment rules into a raw JavaScript filter condition.
      The shopper object variable name is 'c'.
      Available properties on 'c': c.lastOrderDaysAgo (number), c.orders (number), c.totalSpent (number), c.preferredCategory (string).

      CRITICAL RULES:
      - Output ONLY the clean condition string.
      - Never include backticks (\`\`\`), 'javascript', wrapping quotes, or punctuation marks.
      - Example Input: "Find customers who haven't ordered in 90 days"
      - Example Output: c.lastOrderDaysAgo > 90
    `;

    // Pure public web API URL mapping
    const googleEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Dispatch raw standard HTTP payload packet
    const googleResponse = await axios.post(googleEndpoint, {
      contents: [{ parts: [{ text: `${systemInstruction}\n\nUser Request: ${prompt}` }] }],
      generationConfig: { temperature: 0.1 }
    });

    // Extract raw string value out of the Google JSON response schema
    const rawAiText = googleResponse.data.candidates[0].content.parts[0].text;
    const filterCondition = rawAiText.trim().replace(/```javascript|```/g, '').trim();
    
    console.log(`[HTTP REST LOG] Clean Query Generated: ${filterCondition}`);

    // Dynamic compilation loop across local shopper list 
    let targetCustomers = [];
    try {
      const evaluationFunction = new Function('c', `return ${filterCondition};`);
      targetCustomers = customers.filter(c => {
        try { return evaluationFunction(c); } catch { return false; }
      });
    } catch (evalErr) {
      console.error("[CRM LOG] Filter evaluation error:", evalErr);
      return res.status(500).json({ error: "Gemini built an unstable code structure rule.", details: filterCondition });
    }

    const recipientCount = targetCustomers.length;
    if (recipientCount === 0) {
      return res.json({ message: `Gemini compiled rule condition: "${filterCondition}". 0 shoppers matched this.` });
    }

    campaignStats.totalSent += recipientCount;

    // Asynchronous channel simulator
    targetCustomers.forEach(customer => {
      setTimeout(() => {
        const isDelivered = Math.random() > 0.15;
        if (isDelivered) {
          campaignStats.delivered += 1;
          setTimeout(() => {
            if (Math.random() > 0.40) campaignStats.opened += 1;
          }, 2000);
        } else {
          campaignStats.failed += 1;
        }
      }, 1500);
    });

    return res.json({
      message: `AI generated segment condition: "${filterCondition}". Campaign launched successfully to ${recipientCount} shoppers!`
    });

  } catch (error) {
    console.error("[AXIOS CRASH LOG] Complete details:", error.response ? error.response.data : error.message);
    return res.status(500).json({ 
      error: "Failed to communicate with direct REST API pipeline.", 
      details: error.response ? error.response.data : error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`HTTP REST backend running smoothly on port ${PORT}`));