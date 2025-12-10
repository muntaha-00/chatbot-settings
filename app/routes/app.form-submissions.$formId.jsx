import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response.js";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  const { formId } = params;

  if (!shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findFirst({
    where: { id: formId, shop },
    include: {
      fields: {
        orderBy: { order: "asc" },
      },
      submissions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!form) {
    return json({ error: "Form not found" }, { status: 404 });
  }

  // Parse submission data
  const submissionsWithParsedData = form.submissions.map((submission) => ({
    ...submission,
    parsedData: JSON.parse(submission.data),
  }));

  return json({
    form: {
      ...form,
      submissions: submissionsWithParsedData,
    },
  });
};

export default function FormSubmissionsPage() {
  const { form } = useLoaderData();
  const navigate = useNavigate();

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <s-page title={`Submissions: ${form.name}`}>
      <s-section spacing="loose">
        <div style={{ display: "flex", gap: "12px" }}>
          <s-button onClick={() => navigate("/app/form-builder")} variant="secondary">
            â† Back to Forms
          </s-button>
          <s-button onClick={() => navigate("/app")} variant="secondary">
            Home
          </s-button>
        </div>
      </s-section>

      <s-card sectioned>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>
            {form.name}
          </h2>
          {form.description && (
            <p style={{ color: "#666", fontSize: "14px" }}>{form.description}</p>
          )}
          <div style={{ marginTop: "12px", fontSize: "14px", color: "#666" }}>
            Total Submissions: <strong>{form.submissions.length}</strong>
          </div>
        </div>

        {form.submissions.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", background: "#f9fafb", borderRadius: "8px" }}>
            <p style={{ color: "#666" }}>No submissions yet</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", fontSize: "13px" }}>
                    Submitted At
                  </th>
                  {form.fields.map((field) => (
                    <th
                      key={field.id}
                      style={{ padding: "12px", textAlign: "left", fontWeight: "600", fontSize: "13px" }}
                    >
                      {field.label}
                      {field.required && <span style={{ color: "#dc2626" }}> *</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    style={{ borderBottom: "1px solid #e5e7eb" }}
                  >
                    <td style={{ padding: "12px", fontSize: "13px", color: "#666" }}>
                      {formatDate(submission.createdAt)}
                    </td>
                    {form.fields.map((field) => (
                      <td
                        key={field.id}
                        style={{ padding: "12px", fontSize: "13px" }}
                      >
                        {submission.parsedData[field.id] || (
                          <span style={{ color: "#9ca3af", fontStyle: "italic" }}>-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-card>

      {/* Export Options */}
      <s-section spacing="loose">
        <s-card title="Export Data" sectioned>
          <p style={{ marginBottom: "12px", color: "#666" }}>
            Export your form submissions to CSV for further analysis.
          </p>
          <s-button
            variant="secondary"
            onClick={() => {
              // Convert to CSV
              const headers = ["Submitted At", ...form.fields.map((f) => f.label)];
              const rows = form.submissions.map((sub) => [
                formatDate(sub.createdAt),
                ...form.fields.map((field) => sub.parsedData[field.id] || ""),
              ]);
              
              const csv = [
                headers.join(","),
                ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
              ].join("\n");
              
              // Download
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${form.name.replace(/\s+/g, "_")}_submissions.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download CSV
          </s-button>
        </s-card>
      </s-section>
    </s-page>
  );
}