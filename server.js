const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const customers = require('./dataset.json');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// =========================================================================
// CRITICAL: PASTE YOUR ACTUAL GEMINI API KEY INSIDE THE SINGLE QUOTES BELOW!
// Example: 'AIzaSyAz123...'
// =========================================================================
const MY_HARDCODED_KEY = 'AQ.Ab8RN6Kwczsk8QhAvQuJp_GCH6ubJJwew8bd-woovxEfpG1eRQ';

// Robust multi-environment API Key initialization block
const apiKey = process.env.GEMINI_API_KEY || MY_HARDCODED_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

let campaignStats = {
  totalSent: 0,
  delivered: 0,
  opened: 0,
  failed: 0
};

// Endpoint 1: Fetch live statistics for dashboard polling counters
app.get('/api/stats', (req, res) => {
  res.json(campaignStats);
});

// Endpoint 2: Fetch full active directory customer database listings
app.get('/api/customers', (req, res) => {
  res.json(customers);
});

// Endpoint 3: Process plain-text segments with Gemini and launch campaigns
app.post('/api/campaigns/send', async (req, res) => {
  const { prompt, channel } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing campaign segmentation prompt." });
  }

  try {
    // Structured instruction prompt layout ensuring standard syntax outputs from Gemini
    const systemInstruction = `
      You are an expert database engine assistant. 
      Your single task is to translate natural language user segment rules into a raw JavaScript filter condition.
      The shopper object variable name is 'c'.
      Available properties on 'c':
      - c.lastOrderDaysAgo (number)
      - c.orders (number)
      - c.totalSpent (number)
      - c.preferredCategory (string)

      CRITICAL RULES:
      - Output ONLY the clean condition string.
      - Never include backticks (\`\`\`), 'javascript', 'json', wrapping quotes, or punctuation marks.
      - Example Input: "Find customers who haven't ordered in 90 days"
      - Example Output: c.lastOrderDaysAgo > 90
    `;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      }
    });

    const filterCondition = aiResponse.text.trim();
    console.log(`[AI LOG] Generated Filter Condition: ${filterCondition}`);

    // Safely evaluate condition across our local JSON array dataset tracking directory
    let targetCustomers = [];
    try {
      const evaluationFunction = new Function('c', `return ${filterCondition};`);
      targetCustomers = customers.filter(c => {
        try {
          return evaluationFunction(c);
        } catch {
          return false;
        }
      });
    } catch (evalErr) {
      console.error("[CRM LOG] Error parsing AI conditional string logic:", evalErr);
      return res.status(500).json({ 
        error: "AI generated an invalid query condition.", 
        details: filterCondition 
      });
    }

    const recipientCount = targetCustomers.length;
    
    if (recipientCount === 0) {
      return res.json({ 
        message: `AI evaluated rule condition: "${filterCondition}". However, 0 shoppers matched this rule criteria.` 
      });
    }

    // Reset loop metrics to accept fresh task statistics
    campaignStats.totalSent += recipientCount;

    // Trigger completely asynchronous mock channel loops mimicking production gateways
    targetCustomers.forEach(customer => {
      // Step A: Simulate delivery processing delays 
      setTimeout(() => {
        const isDelivered = Math.random() > 0.15; // 85% success benchmark allocation

        if (isDelivered) {
          campaignStats.delivered += 1;
          console.log(`[CRM LOG] Updated status for ${customer.id}: delivered via ${channel}`);

          // Step B: Simulate subsequent opened rates if delivery went green
          setTimeout(() => {
            const isOpened = Math.random() > 0.40; // 60% standard baseline open likelihood
            if (isOpened) {
              campaignStats.opened += 1;
              console.log(`[CRM LOG] Updated status for ${customer.id}: opened`);
            }
          }, 2000);

        } else {
          campaignStats.failed += 1;
          console.log(`[CRM LOG] Updated status for ${customer.id}: failed message handoff`);
        }
      }, 1500);
    });

    return res.json({
      message: `AI generated segment condition: "${filterCondition}". Campaign launched successfully to ${recipientCount} shoppers!`
    });

  } catch (error) {
    console.error("AI Generation Error:", error);
    return res.status(500).json({ error: "Failed to process request with AI layer.", details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CRM backend server is live on port ${PORT}`);
});