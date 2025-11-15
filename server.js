const path = require('path');
const fs = require('fs');
const express = require('express');
const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer');
require('dotenv').config();

const SECRET = process.env.SECRET || "MY_SUPER_SECRET_CHANGE_ME";
const PORT = process.env.PORT || 3000;
const TARGET_URL = process.env.TARGET_URL;
const SUBSCRIBER_NAME = process.env.SUBSCRIBER_NAME;
const SUB_START_ISO = process.env.SUB_START_ISO;
const SUB_END_ISO = process.env.SUB_END_ISO;

const app = express();

let latest = { email:'', password:'', code:'', updatedAt:null, ok:false, error:'', snippet:'' };

function cleanEmail(text) {
  if (!text) return "";
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : "";
}

function cleanPassword(text) {
  if (!text) return "";
  const parts = text.split(/\s+/);
  for (let p of parts.reverse()) {
    if (p.length >= 6 && /[A-Za-z]/.test(p) && /\d/.test(p) && !/@/.test(p)) return p;
  }
  return "";
}

async function startScraper() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote"
    ]
  });

  const page = await browser.newPage();

  console.log("Scraper started → " + TARGET_URL);

  while (true) {
    try {
      await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 35000 });

      const result = await page.evaluate(() => {
        const text = document.body.innerText || "";

        const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        const passMatch = text.match(/\b(?=[A-Za-z]*\d)(?=[A-Za-z\d]{6,})[A-Za-z\d]+\b/);
        const codeMatch = text.match(/\b\d{6}\b/);

        return {
          email: emailMatch ? emailMatch[0] : "",
          password: passMatch ? passMatch[0] : "",
          code: codeMatch ? codeMatch[0] : "",
          snippet: text.substring(0, 2000)
        };
      });

      latest.email = cleanEmail(result.email) || latest.email;
      latest.password = cleanPassword(result.password) || latest.password;
      latest.code = result.code || latest.code;
      latest.updatedAt = new Date().toISOString();
      latest.ok = true;

      console.log("Updated:", latest);
    } catch (err) {
      console.log("SCRAPE ERROR:", err.message);
      latest.error = err.message;
    }

    await new Promise(r => setTimeout(r, 3000));
  }
}

// Start scraper
startScraper();

// API
app.get('/data', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: "token missing" });

  try {
    jwt.verify(token, SECRET);
    return res.json(latest);
  } catch {
    return res.status(403).json({ error: "invalid token" });
  }
});

// VIEW PAGE
app.get('/view', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send("Missing token");

  try {
    jwt.verify(token, SECRET);
  } catch {
    return res.status(403).send("Invalid token");
  }

  const html = `
  <!doctype html>
  <html lang="ar">
  <head>
    <meta charset="utf-8">
    <title>CodeStation</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body{font-family:Arial;background:#f7fbf9;padding:20px;direction:rtl}
      .card{background:white;padding:20px;border-radius:10px;max-width:600px;margin:auto}
      .value{padding:10px;background:#eee;margin-top:6px;border-radius:6px;font-weight:bold;color:#c7173b}
      .btn{padding:8px 14px;background:#16a085;color:white;border-radius:6px;border:none;margin-top:8px;cursor:pointer}
      .code{font-size:28px;letter-spacing:6px}
    </style>
  </head>
  <body>
    <div class="card">
      <h2>مرحباً ${SUBSCRIBER_NAME}</h2>

      <p>البريد الإلكتروني:</p>
      <div id="email" class="value"></div>

      <p>كلمة المرور:</p>
      <div id="pass" class="value"></div>

      <p>كود التفعيل:</p>
      <div id="code" class="value code">------</div>

      <p id="time" style="color:#666;margin-top:10px"></p>
    </div>

<script>
async function update() {
  const token = new URLSearchParams(location.search).get("token");
  const r = await fetch("/data?token=" + token);
  const j = await r.json();

  document.getElementById("email").innerText = j.email || "";
  document.getElementById("pass").innerText = j.password || "";
  document.getElementById("code").innerText = j.code || "------";
  document.getElementById("time").innerText = "آخر تحديث: " + (j.updatedAt || "--");
}
setInterval(update, 2000);
update();
</script>

  </body>
  </html>
  `;

  res.send(html);
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
