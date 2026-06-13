const express = require('express');
const cors = require('cors');
const customers = require('./dataset.json');

const app = express();
app.use(express.json());
app.use(cors());

let campaignStats = {
  totalSent: 0,
  delivered: 0,
  opened: 0,
  failed: 0
};

// Endpoint 1: Fetch live dashboard statistics
app.get('/api/stats', (req, res) => {
  res.json(campaignStats);
});

// Endpoint 2: Fetch active customer list
app.get('/api/customers', (req, res) => {
  res.json(customers);
});

// Endpoint 3: Process text segments using our Local AI Simulation Core
app.post('/api/campaigns/send', async (req, res) => {
  const { prompt, channel } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing campaign segmentation prompt." });
  }

  try {
    console.log(`[LOCAL AI CORE] Processing prompt: "${prompt}"`);
    
    // Normalize prompt to map language intent directly to database fields
    const text = prompt.toLowerCase();
    let filterCondition = "";

    // Exact pattern matcher replicating structural Gemini outputs
    if (text.includes("90 days") || text.includes("90 दिन")) {
      filterCondition = "c.lastOrderDaysAgo > 90";
    } else if (text.includes("30 days") || text.includes("30 दिन")) {
      filterCondition = "c.lastOrderDaysAgo > 30";
    } else if (text.includes("apparel") || text.includes("कपड़े")) {
      filterCondition = "c.preferredCategory === 'Apparel'";
    } else if (text.includes("spent") || text.includes("orders")) {
      filterCondition = "c.totalSpent > 5000";
    } else {
      // Smart baseline fallback condition
      filterCondition = "c.lastOrderDaysAgo >= 0";
    }

    console.log(`[LOCAL AI CORE] Evaluated Filter Condition: ${filterCondition}`);

    // Evaluate condition safely against dataset array
    let targetCustomers = [];
    try {
      const evaluationFunction = new Function('c', `return ${filterCondition};`);
      targetCustomers = customers.filter(c => {
        try { return evaluationFunction(c); } catch { return false; }
      });
    } catch (evalErr) {
      console.error("[CRM LOG] Error parsing conditional string:", evalErr);
      return res.status(500).json({ error: "Local AI layer generated an invalid runtime query." });
    }

    const recipientCount = targetCustomers.length;
    if (recipientCount === 0) {
      return res.json({ 
        message: `Local AI Core evaluated condition: "${filterCondition}". 0 shoppers matched this rule criteria.` 
      });
    }

    // Tick up statistics counters immediately
    campaignStats.totalSent += recipientCount;

    // Trigger asynchronous delivery pipeline simulation loops
    targetCustomers.forEach(customer => {
      // Step A: Simulate delivery latency network delays
      setTimeout(() => {
        const isDelivered = Math.random() > 0.15; // 85% delivery success rule

        if (isDelivered) {
          campaignStats.delivered += 1;
          console.log(`[CRM LOG] Message delivered to ${customer.name} via ${channel}`);

          // Step B: Simulate reading engagement metrics hook
          setTimeout(() => {
            const isOpened = Math.random() > 0.40; // 60% open chance
            if (isOpened) {
              campaignStats.opened += 1;
              console.log(`[CRM LOG] Campaign tracking update: Message opened by ${customer.name}`);
            }
          }, 2000);

        } else {
          campaignStats.failed += 1;
          console.log(`[CRM LOG] Message delivery failed for ${customer.name}`);
        }
      }, 1500);
    });

    return res.json({
      message: `AI-Native Parser generated condition: "${filterCondition}". Campaign launched successfully to ${recipientCount} shoppers!`
    });

  } catch (error) {
    console.error("Critical Exception Handler Error:", error);
    return res.status(500).json({ error: "Failed to process request with AI layer.", details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CRM production backend server is live on port ${PORT}`);
});