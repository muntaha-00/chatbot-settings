import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response.js";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) return json({ questions: [] });

  const questions = await prisma.chatbotQuestion.findMany({
    where: { shop },
    orderBy: { createdAt: "asc" },
  });

  return json({ questions });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  
  if (!shop) {
    return json({ success: false, error: "Shop not found" }, { status: 400 });
  }

  const data = await request.formData();
  const questions = JSON.parse(String(data.get("questions") || "[]"));

  const validQuestions = questions.filter(q => {
    const question = String(q.question || "").trim();
    const answer = String(q.answer || "").trim();
    return question.length > 0 && answer.length > 0;
  });

  if (validQuestions.length === 0 && questions.length > 0) {
    return json({ 
      success: false, 
      error: "All questions must have both question and answer text" 
    }, { status: 400 });
  }

  const seen = new Set();
  for (const q of validQuestions) {
    const normalized = q.question.toLowerCase().trim();
    if (seen.has(normalized)) {
      return json({ 
        success: false, 
        error: `Duplicate question found: "${q.question}"` 
      }, { status: 400 });
    }
    seen.add(normalized);
  }

  const createPayload = validQuestions.map((q) => ({
    shop,
    question: String(q.question).trim(),
    answer: String(q.answer).trim(),
    isActive: !!q.isActive,
  }));

  try {
    await prisma.$transaction([
      prisma.chatbotQuestion.deleteMany({ where: { shop } }),
      ...(createPayload.length > 0 ? [
        prisma.chatbotQuestion.createMany({ data: createPayload })
      ] : [])
    ]);

    return json({ success: true, message: "Questions saved successfully" });
  } catch (error) {
    console.error("❌ Error saving questions:", error);
    return json({ 
      success: false, 
      error: "Failed to save questions" 
    }, { status: 500 });
  }
};

export default function QuestionnairePage() {
  const { questions: loadedQuestions } = useLoaderData();
  const [questions, setQuestions] = useState(
    (loadedQuestions || []).map((q) => ({
      id: q.id ?? null,
      question: q.question ?? "",
      answer: q.answer ?? "",
      isActive: typeof q.isActive === "boolean" ? q.isActive : true,
    }))
  );
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newAnswerText, setNewAnswerText] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fetcher = useFetcher();
  const navigate = useNavigate();

  useEffect(() => {
    if (fetcher.data?.success) {
      setSaved(true);
      setHasUnsavedChanges(false);
      setError("");
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    } else if (fetcher.data?.error) {
      setError(fetcher.data.error);
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data]);

  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [questions]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleAdd = () => {
    const q = newQuestionText.trim();
    const a = newAnswerText.trim();
    
    if (!q || !a) {
      setError("Both question and answer are required");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    const isDuplicate = questions.some(
      existing => existing.question.toLowerCase() === q.toLowerCase()
    );
    
    if (isDuplicate) {
      setError("This question already exists");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    setQuestions([
      ...questions,
      { id: null, question: q, answer: a, isActive: true },
    ]);
    setNewQuestionText("");
    setNewAnswerText("");
  };

  const handleRemove = (index) => {
    if (confirm(`Remove question: "${questions[index].question}"?`)) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const handleChange = (index, field, value) => {
    const next = [...questions];
    next[index] = { ...next[index], [field]: value };
    setQuestions(next);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append(
      "questions",
      JSON.stringify(
        questions.map((q) => ({
          question: q.question,
          answer: q.answer,
          isActive: !!q.isActive,
        }))
      )
    );
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <s-page title="Chatbot Questionnaire">
      <s-section spacing="loose">
        <s-button onClick={() => navigate("/app")} variant="secondary">
          ← Back to Home
        </s-button>
      </s-section>

      <s-card title="Customer Questionnaire" sectioned>
        <s-stack direction="vertical" gap="base">
          {error && (
            <div style={{ padding: 12, background: '#fee', color: '#c00', borderRadius: 8, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {questions.length === 0 && (
            <s-text>No questions yet. Add some below.</s-text>
          )}

          {questions.map((q, i) => (
            <s-stack
              key={i}
              direction="vertical"
              gap="tight"
              style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, background: "#fff" }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => handleChange(i, "question", e.target.value)}
                  placeholder="Customer question"
                  maxLength={200}
                  style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={!!q.isActive}
                    onChange={(e) => handleChange(i, "isActive", e.target.checked)}
                  />
                  Active
                </label>
              </div>

              <textarea
                value={q.answer}
                onChange={(e) => handleChange(i, "answer", e.target.value)}
                placeholder="Answer the question (displayed by chatbot)"
                rows={3}
                maxLength={500}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
              />
              <div style={{ fontSize: 12, color: '#666', textAlign: 'right' }}>
                {q.answer.length}/500 characters
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <s-button variant="secondary" size="slim" onClick={() => handleRemove(i)}>
                  Remove
                </s-button>
              </div>
            </s-stack>
          ))}

          <s-stack direction="vertical" gap="tight" style={{ marginTop: 8 }}>
            <input
              type="text"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="Add a new question..."
              maxLength={200}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <textarea
              value={newAnswerText}
              onChange={(e) => setNewAnswerText(e.target.value)}
              placeholder="Answer for the new question..."
              rows={3}
              maxLength={500}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <s-button variant="primary" size="slim" onClick={handleAdd}>
                Add
              </s-button>
              <s-button variant="outline" size="slim" onClick={() => { setNewQuestionText(""); setNewAnswerText(""); }}>
                Clear
              </s-button>
            </div>
          </s-stack>

          <s-stack direction="horizontal" gap="base" alignment="center" style={{ marginTop: "16px" }}>
            <s-button variant="primary" onClick={handleSave} disabled={fetcher.state === "submitting"}>
              {fetcher.state === "submitting" ? "Saving..." : "Save Questionnaire"}
            </s-button>
            {saved && (
              <s-text style={{ color: "green", marginLeft: "12px" }}>
                ✓ Questionnaire saved successfully!
              </s-text>
            )}
          </s-stack>
        </s-stack>
      </s-card>
    </s-page>
  );
}

