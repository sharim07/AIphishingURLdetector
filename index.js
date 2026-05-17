const scanHistory = [];

function setLoading(on) {
  document.getElementById('loading').style.display = on ? 'block' : 'none';
  document.getElementById('scanBtn').disabled = on;
  if (on) {
    document.getElementById('result').style.display = 'none';
    document.getElementById('error').style.display = 'none';
  }
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
}

async function scanURL() {
  const url    = document.getElementById('urlInput').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();

  if (!url)    return showError('Please enter a URL to scan.');
  if (!apiKey) return showError('Please enter your Gemini API key.');
  

  setLoading(true);

  const prompt = `You are a cybersecurity expert specializing in phishing detection. Analyze this URL for phishing indicators:

URL: ${url}

Respond ONLY with a valid JSON object (no markdown, no code blocks) in exactly this format:
{
  "verdict": "SAFE" | "WARNING" | "DANGEROUS",
  "risk_score": <integer 0-100>,
  "flags": [
    { "icon": "<emoji>", "text": "<short red flag description>" }
  ],
  "explanation": "<2-4 sentence plain-English analysis of why this URL is or isn't suspicious, what patterns were detected, and what the user should do>"
}

Rules:
- verdict SAFE = score 0-30, WARNING = 31-65, DANGEROUS = 66-100
- flags array: 1-2 items if SAFE, 2-4 if WARNING, 3-6 if DANGEROUS
- Use relevant emojis: 🔴 for critical, 🟡 for warning, ✅ for safe signals, 🔗 for URL structure issues, 🌐 for domain issues, 📧 for phishing patterns, 🔒 for HTTPS issues, 💀 for malware indicators
- explanation must be clear for a non-technical user`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
        })
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Could not parse AI response. Please try again.');
    }

    renderResult(url, parsed);
    addToHistory(url, parsed.verdict, parsed.risk_score);

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

function renderResult(url, data) {
  const { verdict, risk_score, flags, explanation } = data;

  const badge = document.getElementById('verdictBadge');
  badge.className = 'verdict-badge';
  const cls = verdict === 'SAFE' ? 'safe' : verdict === 'DANGEROUS' ? 'danger' : 'warning';
  badge.classList.add(cls);
  document.getElementById('verdictText').textContent = verdict;

  document.getElementById('scannedUrl').textContent = url;

  const score = Math.min(100, Math.max(0, parseInt(risk_score) || 0));
  document.getElementById('riskScoreVal').textContent = score + ' / 100';
  document.getElementById('riskScoreVal').style.color =
    cls === 'safe' ? 'var(--accent2)' : cls === 'danger' ? 'var(--danger)' : 'var(--warn)';

  const fill = document.getElementById('riskBarFill');
  fill.style.background =
    cls === 'safe' ? 'var(--accent2)' : cls === 'danger' ? 'var(--danger)' : 'var(--warn)';
  setTimeout(() => { fill.style.width = score + '%'; }, 100);

  const grid = document.getElementById('flagsGrid');
  grid.innerHTML = '';
  if (flags && flags.length) {
    flags.forEach(f => {
      const div = document.createElement('div');
      div.className = 'flag-item';
      div.innerHTML = `<span class="flag-icon">${f.icon || '🔍'}</span><span>${f.text}</span>`;
      grid.appendChild(div);
    });
  } else {
    grid.innerHTML = '<div class="flag-item"><span class="flag-icon">✅</span><span>No red flags detected</span></div>';
  }

  document.getElementById('explanationBox').textContent = explanation || 'No explanation available.';
  document.getElementById('result').style.display = 'block';
}

function addToHistory(url, verdict, score) {
  scanHistory.unshift({ url, verdict, score });
  if (scanHistory.length > 5) scanHistory.pop();
  renderHistory();
}

function renderHistory() {
  const section = document.getElementById('history-section');
  const list    = document.getElementById('historyList');
  section.style.display = 'block';
  list.innerHTML = '';

  scanHistory.forEach(item => {
    const cls = item.verdict === 'SAFE' ? 'hb-safe' : item.verdict === 'DANGEROUS' ? 'hb-danger' : 'hb-warning';
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <span class="history-url">${item.url}</span>
      <span class="history-badge ${cls}">${item.verdict} · ${item.score}/100</span>
    `;
    div.onclick = () => {
      document.getElementById('urlInput').value = item.url;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    list.appendChild(div);
  });
}

document.getElementById('urlInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') scanURL();
});

const savedKey = sessionStorage.getItem('gemini_key');
if (savedKey) document.getElementById('apiKey').value = savedKey;

document.getElementById('apiKey').addEventListener('input', e => {
  sessionStorage.setItem('gemini_key', e.target.value);
});
