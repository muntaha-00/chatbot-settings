import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Local JSON helper
function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

// Loader: Load all saved questions
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const questions = await prisma.chatbotQuestion.findMany();
  return json({ questions });
};

// Action: Save questions list
export const action = async ({ request }) => {
  await authenticate.admin(request);
  const data = await request.formData();
  const questions = JSON.parse(data.get("questions") || "[]");

  await prisma.chatbotQuestion.deleteMany(); // reset old
  for (const q of questions) {
    await prisma.chatbotQuestion.create({ data: { question: q } });
  }

  return json({ success: true });
};

// Component
export default function QuestionnairePage() {
  const { questions: loadedQuestions } = useLoaderData();
  const [questions, setQuestions] = useState(loadedQuestions.map(q => q.question));
  const [newQuestion, setNewQuestion] = useState("");
  const [saved, setSaved] = useState(false); // ✅ success indicator
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const handleAdd = () => {
    if (newQuestion.trim()) {
      setQuestions([...questions, newQuestion.trim()]);
      setNewQuestion("");
    }
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("questions", JSON.stringify(questions));
    fetcher.submit(formData, { method: "post" });
  };

  // Watch for successful save
  useEffect(() => {
    if (fetcher.data?.success) {
      setSaved(true);
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data]);

  return (
    <s-page title="Chatbot Questionnaire">
      <s-section spacing="loose">
        <s-button onClick={() => navigate("/app")} variant="secondary">
          ← Back to Home
        </s-button>
      </s-section>

      <s-card title="Customer Questionnaire" sectioned>
        <s-stack direction="vertical" gap="base">
          {questions.map((q, i) => (
            <s-stack key={i} direction="horizontal" gap="base" style={{ justifyContent: "space-between" }}>
              <s-text>{q}</s-text>
              <s-button
                variant="secondary"
                size="slim"
                onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))}
              >
                Remove
              </s-button>
            </s-stack>
          ))}

          <s-stack direction="horizontal" gap="base">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Add a new question..."
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid #ccc",
              }}
            />
            <s-button variant="primary" size="slim" onClick={handleAdd}>
              Add
            </s-button>
          </s-stack>

          <s-stack direction="horizontal" gap="base" alignment="center" style={{ marginTop: "16px" }}>
            <s-button variant="primary" onClick={handleSave}>
              Save Questionnaire
            </s-button>
            {/* Success message */}
            {saved && (
              <s-text style={{ color: "green", marginLeft: "12px" }}>
                Questionnaire saved successfully!
              </s-text>
            )}
          </s-stack>
        </s-stack>
      </s-card>
    </s-page>
  );
}
