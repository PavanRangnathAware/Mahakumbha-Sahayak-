// Kumbh Mitra chatbot backend — keeps your Anthropic API key secret
// and proxies chat requests from the website to the Anthropic API.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the website itself (index.html + assets) from /public
app.use(express.static('public'));

const GRIEVANCE_FILE = path.join(__dirname, 'grievances.json');
function readGrievances(){
  try{ return JSON.parse(fs.readFileSync(GRIEVANCE_FILE, 'utf8')); }catch(e){ return []; }
}
function writeGrievances(list){
  fs.writeFileSync(GRIEVANCE_FILE, JSON.stringify(list, null, 2));
}

// Save a grievance submitted from the "Register Grievance" form
app.post('/api/grievance', (req, res) => {
  try {
    const { name, phone, email, category, subject, details, priority } = req.body;
    if (!name || !phone || !email || !subject || !details) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const ticket = 'KM-' + Math.floor(100000 + Math.random() * 900000);
    const record = { ticket, name, phone, email, category, subject, details, priority, status: 'open', createdAt: new Date().toISOString() };
    const list = readGrievances();
    list.push(record);
    writeGrievances(list);
    res.json({ ticket });
  } catch (err) {
    console.error('Grievance save error:', err);
    res.status(500).json({ error: 'Could not save grievance' });
  }
});

// Basic lookup so staff can pull grievances (add real auth before using this in production)
app.get('/api/grievance', (req, res) => {
  res.json(readGrievances());
});


const SYSTEM_PROMPT = "You are Kumbh Mitra, a warm, practical AI assistant helping pilgrims at the Mahakumbh (Sinhastha Kumbh Mela) in Nashik and Trimbakeshwar, India. Help with: directions to ghats and temples (Ramkund, Panchavati, Kushavarta Kund/Trimbakeshwar), facilities (medical camps, water points, toilets, help desks, parking, accommodation), safety and crowd-avoidance tips, what to do if separated from one's group, basic ritual/bathing etiquette, and local transport. Keep answers short, concrete, and reassuring — 3-5 sentences max unless asked for detail. If asked for real-time crowd numbers, live official announcements, or exact current facility locations, clearly say this demo isn't connected to the official live Kumbh Mela data feed and advise checking official signage, help desks, or the authority's app/website for live info. Never invent specific live statistics.";

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, // set this as an environment variable, never hardcode it
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Upstream API error' });
    }

    res.json(data);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kumbh Mitra server running on http://localhost:${PORT}`));
