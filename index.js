// index.js
import express from "express";
import OpenAI from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ 1. 서버 살아있다는 확인용 라우트
app.get("/", (req, res) => {
  res.send("✅ Assistant-runner is running!");
});

// ✅ 2. GPT Assistant 자동 실행
async function runAssistant() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const thread = await openai.beta.threads.create();

  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: "Summarize this: AI tools are changing everything.",
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: process.env.ASSISTANT_ID,
  });

  let status;
  do {
    const result = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    status = result.status;
    await new Promise((r) => setTimeout(r, 1000));
  } while (status !== "requires_action" && status !== "completed");

  if (status === "requires_action") {
    const fc = run.required_action.submit_tool_outputs.tool_calls[0];
    const args = JSON.parse(fc.function.arguments);

    const webhookRes = await fetch("https://customgptconnect.vercel.app/api/run_n8n", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    const webhookData = await webhookRes.json();

    await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
      tool_outputs: [
        {
          tool_call_id: fc.id,
          output: JSON.stringify(webhookData.result),
        },
      ],
    });

    const messages = await openai.beta.threads.messages.list(thread.id);
    console.log("✅ Final GPT response:", messages.data[0].content[0].text.value);
  }
}

// ✅ 3. 서버 실행 + GPT 자동 실행
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
  runAssistant(); // 서버 켜질 때 한 번 실행
});
