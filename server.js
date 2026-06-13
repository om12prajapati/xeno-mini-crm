const express = require('express');
const cors = require('cors');
const customers = require('./dataset.json');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// =========================================================================
// CRITICAL STEP: Paste your direct AIzaSy... key inside the single quotes!
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

// Endpoint 3: Connects directly to Google's raw REST gateway via HTTP fetch
app.post('/api/campaigns/send', async (req, res) => {
  const { prompt, channel } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing campaign prompt." });
  }

  try {
    console.log(`[REST API] Contacting Google Endpoints for prompt: "${prompt}"`);

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

    // Construct raw HTTP packet for Google's native Gemini v1beta gateway
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.1 }
      })
    });

    const data = await response.json();

    // Check if Google returned an internal API error block
    if (data.error) {
      console.error("[GOOGLE SERVER ERROR]:", data.error);
      return res.status(data.error.code || 401).json({ 
        error: `Google API Error: ${data.error.message}`,
        status: data.error.status 
      });
    }

    // Safely pull the text response out of the nested JSON structure
    const rawAiText = data.candidates[0].content.parts[0].text;
    const filterCondition = rawAiText.trim().replace(/```javascript|```/g, '').trim();
    
    console.log(`[AI LOG] Live Gemini Filter Condition: ${filterCondition}`);

    // Evaluate condition across database
    let targetCustomers = [];
    try {
      const evaluationFunction = new Function('c', `return ${filterCondition};`);
      targetCustomers = customers.filter(c => {
        try { return evaluationFunction(c); } catch { return false; }
      });
    } catch (evalErr) {
      console.error("[CRM LOG] Condition evaluation compile crash:", evalErr);
      return res.status(500).json({ error: "Gemini built an unstable syntax check string.", details: filterCondition });
    }

    const recipientCount = targetCustomers.length;
    if (recipientCount === 0) {
      return res.json({ message: `Gemini calculated condition: "${filterCondition}". 0 shoppers matched this criteria.` });
    }

    campaignStats.totalSent += recipientCount;

    // Asynchronous channel execution loop simulations
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
    console.error("Fetch Execution Crash:", error);
    return res.status(500).json({ error: "Failed to communicate with direct REST API pipeline.", details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CRM backend running via direct REST loop on port ${PORT}`));