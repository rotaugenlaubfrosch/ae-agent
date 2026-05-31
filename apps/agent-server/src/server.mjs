import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

const PORT = Number(process.env.AE_AGENT_PORT || 3789);
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const API_KEY = process.env.OPENAI_API_KEY;

const blockedPatterns = [
  /\bFile\b/,
  /\bFolder\b/,
  /\bSocket\b/,
  /system\.callSystem/,
  /\$\.evalFile/,
  /app\.quit\s*\(/,
  /app\.project\.close\s*\(/,
  /\.remove\s*\(/,
  /delete\s+/,
];

const send = (res, status, data) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(data));
};

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
};

const loadPrompt = (name) => readFile(resolve(root, "shared/prompts", name), "utf8");

async function callLlm(messages) {
  if (!API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

function extractCode(text) {
  const fenced = text.match(/```(?:jsx|javascript|js)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function localReview(code) {
  const hits = blockedPatterns
    .filter((pattern) => pattern.test(code))
    .map((pattern) => pattern.source);

  return {
    ok: hits.length === 0,
    issues: hits.map((hit) => `Blocked pattern: ${hit}`),
  };
}

async function generateCode(prompt, history = []) {
  const system = await loadPrompt("codegen.md");
  const output = await callLlm([
    { role: "system", content: system },
    ...history.slice(-8),
    { role: "user", content: prompt },
  ]);
  return extractCode(output);
}

async function llmReview(code) {
  const system = await loadPrompt("reviewer.md");
  const output = await callLlm([
    { role: "system", content: system },
    { role: "user", content: code },
  ]);
  return output;
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });

  if (req.method === "POST" && req.url === "/chat") {
    try {
      const body = await readJson(req);
      const code = await generateCode(body.message, body.history || []);
      const local = localReview(code);
      const reviewerNote = local.ok ? await llmReview(code) : "Skipped LLM review because local safety failed.";

      return send(res, 200, {
        type: "code_proposal",
        code,
        review: {
          ok: local.ok,
          issues: local.issues,
          note: reviewerNote,
        },
      });
    } catch (error) {
      return send(res, 500, { error: error.message });
    }
  }

  send(res, 404, { error: "Not found" });
}).listen(PORT, () => {
  console.log(`ae-agent server listening on http://localhost:${PORT}`);
});
