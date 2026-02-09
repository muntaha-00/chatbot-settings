import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response";

//loader - fetch forms
export const loader = async({ request })=> {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) return json({forms: [] });

  const forms = await prisma.form.findMany({
    where: {shop},
    include: {
      fields: { orderBy: { order: "asc" }},
      submissions: true
    },
    orderBy: { createdAt: "desc"},
  });
  return json ({ forms, shop });
};

//action - handle saving forms
  //action - handle saving forms
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;

  if (!shop) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    // CREATE
    if (actionType === "create") {
      const name = (formData.get("name") ?? "").trim();
      const editorType = formData.get("editorType") ?? "plain";
      
      if (!name) {
        return json({ success: false, error: "Form name required" }, { status: 400 });
      }
      
      const form = await prisma.form.create({
        data: { 
          shop, 
          name, 
          description: editorType,
          isActive: true,
          cartSettings: JSON.stringify({
            mode: "existing_product",
            redirectAfterAdd: true,
            showSuccessMessage: true,
            successMessage: "Added to cart!"
          })
        },
        include: { fields: true },
      });
      
      return json({ 
        success: true, 
        form,
        editorType,
        action: "create"
      });
    }

    // UPDATE
    if (actionType === "update") {
      const formId = formData.get("formId");
      const name = (formData.get("name") ?? "").trim();
      
      if (!formId || !name) {
        return json({ success: false, error: "Missing required fields" }, { status: 400 });
      }

      // Parse and validate JSON fields
      let fields = [];
      try {
        const fieldsJson = formData.get("fields") ?? "[]";
        fields = JSON.parse(fieldsJson);
        if (!Array.isArray(fields)) {
          throw new Error("Fields must be an array");
        }
      } catch (error) {
        return json({ success: false, error: "Invalid fields data" }, { status: 400 });
      }
      
      // Parse canvas settings with validation
      const parseJsonSetting = (key) => {
        const value = formData.get(key);
        if (!value || value === "null") return null;
        try {
          return value;
        } catch {
          console.warn(`Failed to parse ${key}, skipping`);
          return null;
        }
      };

      // Use transaction for updates
      await prisma.$transaction(async (tx) => {
        // Update form
        await tx.form.update({
          where: { id: formId },
          data: { 
            name,
            formulaSettings: parseJsonSetting("formulaSettings"),
            productSettings: parseJsonSetting("productSettings"),
            nonProductSettings: parseJsonSetting("nonProductSettings"),
            advancedSettings: parseJsonSetting("advancedSettings"),
            cartSettings: parseJsonSetting("cartSettings"),
          },
        });

        // Delete existing fields
        await tx.formField.deleteMany({ where: { formId } });

        // Create new fields
        if (fields.length > 0) {
          const fieldsToCreate = fields.map((field, index) => ({
            formId,
            type: field.type,
            label: field.label,
            placeholder: field.placeholder ?? null,
            required: field.required ?? false,
            options: field.options ?? null,
            metadata: field.metadata ?? null,
            order: field.order ?? index,
          }));

          await tx.formField.createMany({
            data: fieldsToCreate,
          });
        }
      });

      return json({ success: true, action: "update" });
    }

    // DELETE - Return deleted form ID for optimistic update
    if (actionType === "delete") {
      const formId = formData.get("formId");
      
      if (!formId) {
        return json({ success: false, error: "Form ID required" }, { status: 400 });
      }
      
      await prisma.form.delete({ where: { id: formId } });
      return json({ success: true, action: "delete", deletedId: formId });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
    
  } catch (error) {
    console.error("Form builder error:", error);
    return json(
      { success: false, error: error.message || "Operation failed" }, 
      { status: 500 }
    );
  }
};

// ==================== COMPONENT ====================
export default function FormBuilderLanding() {
  const loaderData = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [selectedEditorType, setSelectedEditorType] = useState("plain");
  const [deletingFormId, setDeletingFormId] = useState(null);

  // Filter out deleted form for optimistic UI and separate templates
  const regularForms = loaderData.forms.filter(form => 
    form.id !== deletingFormId && !form.isTemplate
  );
  const templateCount = loaderData.forms.filter(form => form.isTemplate).length;

  const isCreating = fetcher.state === "submitting" && 
    fetcher.formData?.get("actionType") === "create";

  // Handle navigation after form creation
  useEffect(() => {
    if (
      fetcher.state === "idle" && 
      fetcher.data?.success && 
      fetcher.data?.action === "create" &&
      fetcher.data?.form
    ) {
      const editorType = fetcher.data.editorType || "plain";
      const formId = fetcher.data.form.id;
      const route = editorType === "dnd" 
        ? `/app/form-builder-edit-dnd/${formId}`
        : `/app/form-builder-edit/${formId}`;
      
      navigate(route, { replace: true });
    }
  }, [fetcher.state, fetcher.data, navigate]);

  // Handle successful deletion
  useEffect(() => {
    if (
      fetcher.state === "idle" && 
      fetcher.data?.success && 
      fetcher.data?.action === "delete"
    ) {
      setDeletingFormId(null);
    }
  }, [fetcher.state, fetcher.data]);

  // Show error toast if operation fails
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && !fetcher.data.success) {
      console.error("Operation failed:", fetcher.data.error);
      alert(`Error: ${fetcher.data.error}`);
      setDeletingFormId(null);
    }
  }, [fetcher.state, fetcher.data]);

  const handleCreateForm = () => {
    if (!newFormName.trim()) return;
    
    const formData = new FormData();
    formData.append("actionType", "create");
    formData.append("name", newFormName);
    formData.append("editorType", selectedEditorType);
    
    fetcher.submit(formData, { method: "post" });
    
    setShowCreateModal(false);
    setNewFormName("");
    setSelectedEditorType("plain");
  };

  const handleDeleteForm = (formId, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this form? This action cannot be undone.")) {
      return;
    }
    
    setDeletingFormId(formId);
    
    const formData = new FormData();
    formData.append("actionType", "delete");
    formData.append("formId", formId);
    
    fetcher.submit(formData, { 
      method: "post",
      action: "/app/form-builder"
    });
  };

  const getEditorRoute = (form) => {
    const editorType = form.description || "plain";
    return editorType === "dnd" 
      ? `/app/form-builder-edit-dnd/${form.id}`
      : `/app/form-builder-edit/${form.id}`;
  };

  return (
    <s-page title="Form Builder">
      <s-section spacing="loose">
        <s-button onClick={() => navigate("/app")} variant="secondary">
          ← Back to Home
        </s-button>
      </s-section>

      {/* Actions Grid */}
      <s-section spacing="loose">
        <div style={styles.quickActionsGrid}>
          {/* Create New Form Card */}
          <s-card sectioned>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>
                  Create New Form
                </h2>
                <p style={{ color: "#666", fontSize: "14px" }}>
                  Build a custom calculator from scratch
                </p>
              </div>
              <div style={{ fontSize: "48px" }}>📋</div>
            </div>
            <div style={{ marginTop: "16px" }}>
              <s-button 
                onClick={() => setShowCreateModal(true)} 
                variant="primary"
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Form"}
              </s-button>
            </div>
          </s-card>

          {/* Browse Templates Card */}
          <s-card sectioned>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>
                  Browse Templates
                </h2>
                <p style={{ color: "#666", fontSize: "14px" }}>
                  {templateCount} Ready-To-Use Templates
                </p>
              </div>
              <div style={{ fontSize: "48px" }}>⭐</div>
            </div>
            <div style={{ marginTop: "16px" }}>
              <s-button 
                onClick={() => navigate("/app/form-templates")} 
                variant="secondary"
              >
                View Templates ({templateCount})
              </s-button>
            </div>
          </s-card>
        </div>
      </s-section>

      {/* Existing Forms */}
      {regularForms.length > 0 && (
        <s-section spacing="loose">
          <s-card>
            <div style={{ padding: "16px", borderBottom: "1px solid #e5e7eb" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600" }}>Your Forms</h3>
            </div>
            <div style={{ padding: "16px" }}>
              {deletingFormId && (
                <div style={{ 
                  padding: "12px", 
                  background: "#fef3c7", 
                  borderRadius: "6px",
                  marginBottom: "16px",
                  fontSize: "14px"
                }}>
                  Deleting form...
                </div>
              )}
              <s-stack direction="vertical" gap="tight">
                {regularForms.map((form) => (
                  <div 
                    key={form.id} 
                    style={{
                      ...styles.formCard,
                      opacity: deletingFormId === form.id ? 0.5 : 1,
                      pointerEvents: deletingFormId === form.id ? "none" : "auto"
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          {form.name}
                        </div>
                        <span style={{
                          background: form.description === "dnd" ? "#dbeafe" : "#f3e8ff",
                          color: form.description === "dnd" ? "#1e40af" : "#6b21a8",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "600"
                        }}>
                          {form.description === "dnd" ? "✨ DnD" : "🎯 Plain"}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {form.fields.length} components • {form.submissions?.length || 0} submissions
                      </div>
                    </div>
                    <s-stack direction="horizontal" gap="tight">
                      <s-button 
                        onClick={() => navigate(getEditorRoute(form))}
                        variant="primary"
                        size="slim"
                      >
                        Edit
                      </s-button>
                      <s-button 
                        onClick={() => navigate(`/app/form-submissions/${form.id}`)}
                        variant="secondary"
                        size="slim"
                      >
                        View Submissions
                      </s-button>
                      <s-button 
                        onClick={(e) => handleDeleteForm(form.id, e)}
                        variant="secondary"
                        size="slim"
                        disabled={deletingFormId === form.id}
                      >
                        {deletingFormId === form.id ? "Deleting..." : "Delete"}
                      </s-button>
                    </s-stack>
                  </div>
                ))}
              </s-stack>
            </div>
          </s-card>
        </s-section>
      )}

      {/* No forms message */}
      {regularForms.length === 0 && !deletingFormId && (
        <s-section spacing="loose">
          <s-card sectioned>
            <div style={{ textAlign: "center", padding: "32px", color: "#666" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
              <p>No forms yet. Create your first form or browse templates!</p>
            </div>
          </s-card>
        </s-section>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "16px" }}>Create New Form</h2>
            <s-stack direction="vertical" gap="base">
              <div>
                <label style={styles.label}>Form Name</label>
                <input
                  type="text"
                  value={newFormName}
                  onChange={(e) => setNewFormName(e.target.value)}
                  placeholder="Form name..."
                  style={styles.input}
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newFormName.trim()) {
                      handleCreateForm();
                    }
                  }}
                />
              </div>

              <div>
                <label style={styles.label}>Editor Type</label>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <button
                    onClick={() => setSelectedEditorType("plain")}
                    style={{
                      ...styles.editorTypeButton,
                      ...(selectedEditorType === "plain" ? styles.editorTypeButtonActive : {})
                    }}
                  >
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎯</div>
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>React Plain</div>
                    <div style={{ fontSize: "12px", opacity: 0.8 }}>HTML5 Drag & Drop</div>
                  </button>
                  
                  <button
                    onClick={() => setSelectedEditorType("dnd")}
                    style={{
                      ...styles.editorTypeButton,
                      ...(selectedEditorType === "dnd" ? styles.editorTypeButtonActive : {})
                    }}
                  >
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>✨</div>
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>React DnD</div>
                    <div style={{ fontSize: "12px", opacity: 0.8 }}>Professional Library</div>
                  </button>
                </div>
              </div>

              <s-stack direction="horizontal" gap="base" alignment="trailing">
                <s-button 
                  onClick={() => setShowCreateModal(false)} 
                  variant="secondary"
                  disabled={isCreating}
                >
                  Cancel
                </s-button>
                <s-button
                  onClick={handleCreateForm}
                  disabled={!newFormName.trim() || isCreating}
                  variant="primary"
                >
                  {isCreating ? "Creating..." : "Create"}
                </s-button>
              </s-stack>
            </s-stack>
          </div>
        </div>
      )}
    </s-page>
  );
}

const styles = {
  quickActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
  },
  formCard: {
    display: "flex",
    alignItems: "center",
    padding: "16px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    transition: "all 0.2s",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#374151",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    padding: "24px",
    borderRadius: "12px",
    width: "500px",
    maxWidth: "90%",
  },
  editorTypeButton: {
    flex: 1,
    padding: "16px",
    background: "#f9fafb",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
    textAlign: "center",
  },
  editorTypeButtonActive: {
    background: "#eff6ff",
    border: "2px solid #3b82f6",
    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
  },
};