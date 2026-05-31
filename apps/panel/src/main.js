import "./styles.css";

const API_URL = "http://localhost:3789";
const messagesEl = document.querySelector("#messages");
const formEl = document.querySelector("#composer");
const promptEl = document.querySelector("#prompt");

const history = [];

function addMessage(role, content, action) {
  const el = document.createElement("article");
  el.className = `message ${role}`;

  const pre = document.createElement("pre");
  pre.textContent = content;
  el.append(pre);

  if (action) el.append(action);
  messagesEl.append(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function wrapForExecution(code) {
  return `
(function () {
  app.beginUndoGroup("ae-agent");
  try {
${code}
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.toString() });
  } finally {
    app.endUndoGroup();
  }
}())`;
}

function evalInAfterEffects(code) {
  return new Promise((resolve) => {
    const script = wrapForExecution(code);

    if (window.__adobe_cep__) {
      window.__adobe_cep__.evalScript(script, resolve);
      return;
    }

    resolve("Not running inside CEP. Code was not executed.");
  });
}

async function requestCode(message) {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = promptEl.value.trim();
  if (!message) return;

  promptEl.value = "";
  addMessage("user", message);
  history.push({ role: "user", content: message });

  try {
    addMessage("agent", "Generating ExtendScript...");
    const proposal = await requestCode(message);
    const approve = document.createElement("button");
    approve.textContent = proposal.review.ok ? "Approve and run" : "Blocked by safety review";
    approve.disabled = !proposal.review.ok;

    approve.addEventListener("click", async () => {
      approve.disabled = true;
      const result = await evalInAfterEffects(proposal.code);
      addMessage("agent", `Execution result:\n${result}`);
      history.push({ role: "assistant", content: `Executed script. Result: ${result}` });
    });

    addMessage(
      "agent",
      `Review:\n${proposal.review.note}\n\nCode:\n${proposal.code}`,
      approve,
    );
    history.push({ role: "assistant", content: proposal.code });
  } catch (error) {
    addMessage("agent", `Error: ${error.message}`);
  }
});
