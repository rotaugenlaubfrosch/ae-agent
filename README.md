# ae-agent

Dynamic-code MVP for an After Effects chat panel.

## What this is

- CEP panel with a chat UI.
- Local Node agent server.
- LLM generates ExtendScript on demand.
- User approves generated code before it runs in After Effects.
- No static task scripts like `createComposition.jsx`.

## Run

```sh
npm install
OPENAI_API_KEY=... npm run dev:server
npm run dev:panel
```

For After Effects CEP use:

```sh
npm --workspace apps/panel run build
npm run install:cep
```

Then restart After Effects and open `Window > Extensions > ae-agent`.

For unsigned CEP extensions, enable Adobe CEP debug mode for your AE version.

## Environment

```sh
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
AE_AGENT_PORT=3789
```

## Safety model

The generated script is shown before execution. The local reviewer blocks obvious filesystem, shell, socket, app close/quit, evalFile, and destructive patterns. The LLM reviewer adds a second opinion.
