import React, { useState, useEffect } from 'react';

function App() {
  const [prompt, setPrompt] = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({ totalSent: 0, delivered: 0, opened: 0, failed: 0 });
  const [customers, setCustomers] = useState([]);

  // Fetch live stats and customer lists from our Node.js backend
  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch('https://xeno-mini-crm-k8pv.onrender.com/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      const custRes = await fetch('https://xeno-mini-crm-k8pv.onrender.com/api/customers');
      const custData = await custRes.json();
      setCustomers(custData);
    } catch (err) {
      console.error("Error connecting to backend:", err);
    }
  };

  // Automatically poll the backend every 1 second to capture the async channel service callbacks live!
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 1000);
    return () => clearInterval(interval);
  }, []);

  // Send the natural language prompt to our AI Campaign system
  const handleLaunchCampaign = async (e) => {
    e.preventDefault();
    if (!prompt) return alert("Please enter an AI prompt first!");

    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('https://xeno-mini-crm-k8pv.onrender.com/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, channel }),
      });
      const data = await res.json();
      setMessage(data.message || data.error);
    } catch (err) {
      setMessage("Failed to reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      <h1 style={{ color: '#1e293b' }}>⚡ Xeno AI-Native Mini CRM</h1>
      <p style={{ color: '#64748b' }}>Describe an audience segment in plain English to launch a dynamic marketing campaign.</p>

      {/* --- STATS CARD SECTION --- */}
      <div style={{ display: 'flex', gap: '20px', margin: '30px 0' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', flex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#64748b' }}>Total Sent</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#3b82f6' }}>{stats.totalSent}</p>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', flex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#64748b' }}>Delivered</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#10b981' }}>{stats.delivered}</p>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', flex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#64748b' }}>Opened</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#8b5cf6' }}>{stats.opened}</p>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', flex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#64748b' }}>Failed</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#ef4444' }}>{stats.failed}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '30px' }}>
        {/* --- CAMPAIGN GENERATOR FORM --- */}
        <div style={{ flex: 1, background: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h2>Create Campaign</h2>
          <form onSubmit={handleLaunchCampaign}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Ask AI to Segment Shoppers:</label>
            <textarea
              style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: '15px' }}
              placeholder="e.g., Find customers who haven't ordered in 90 days"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select Channel:</label>
            <select 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '20px' }}
              value={channel} 
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="SMS">SMS</option>
              <option value="Email">Email</option>
            </select>

            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {loading ? 'AI is analyzing...' : '🚀 Launch Campaign with AI'}
            </button>
          </form>

          {message && (
            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '6px', backgroundColor: '#f1f5f9', borderLeft: '4px solid #1e293b', fontSize: '14px' }}>
              <strong>System Response:</strong> {message}
            </div>
          )}
        </div>

        {/* --- CUSTOMER DIRECTORY VIEW --- */}
        <div style={{ flex: 1, background: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h2>Active Customer Profiles</h2>
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {customers.map((c) => (
              <div key={c.id} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: '14px' }}>
                <strong>{c.name}</strong> ({c.preferredCategory})<br />
                <span style={{ color: '#64748b', fontSize: '12px' }}>
                  Orders: {c.totalOrders} | Last Order: {c.lastOrderDaysAgo} days ago
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;