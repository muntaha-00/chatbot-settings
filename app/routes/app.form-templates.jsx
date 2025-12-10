import React, { useState, useEffect } from "react";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response";

// loader
export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;

    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // fetch only templates for the current shop
    const templates = await prisma.form.findMany({
      where: { 
        shop,
        isTemplate: true 
      },
      orderBy: { updatedAt: "desc" },
      include: {
        fields: {
          select: { 
            id: true,
            type: true 
          },
        },
      },
    });

    return json({ templates });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
};

// ---------- action-----------------
export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;

    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "duplicateTemplate") {
      const templateId = formData.get("templateId");

      // fetch original template with all fields
      const originalTemplate = await prisma.form.findFirst({
        where: { 
          id: templateId, 
          shop,
          isTemplate: true 
        },
        include: { fields: true },
      });

      if (!originalTemplate) {
        return json({ error: "Template not found" }, { status: 404 });
      }

      // Create new form
      const newForm = await prisma.form.create({
        data: {
          shop,
          name: originalTemplate.templateName || originalTemplate.name,
          description: originalTemplate.description,
          isTemplate: false, // create as a regular form
          isActive: true,
          formulaSettings: originalTemplate.formulaSettings,
          productSettings: originalTemplate.productSettings,
          nonProductSettings: originalTemplate.nonProductSettings,
          advancedSettings: originalTemplate.advancedSettings,
          fields: {
            create: originalTemplate.fields.map(field => ({
              type: field.type,
              label: field.label,
              placeholder: field.placeholder,
              required: field.required,
              order: field.order,
              options: field.options,
              metadata: field.metadata,
            })),
          },
        },
      });

      return json({ 
        success: true, 
        formId: newForm.id,
        editorType: newForm.description || "plain"
      });
    }

    if (actionType === "deleteTemplate") {
      const templateId = formData.get("templateId");

      // delete all fields first
      await prisma.formField.deleteMany({
        where: { formId: templateId },
      });

      // delete the template
      await prisma.form.delete({
        where: { 
          id: templateId, 
          shop 
        },
      });

      return json({ success: true, message: "Template deleted successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
};

// ---------- Component -----------------------------------------
export default function FormTemplates() {
  const { templates } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);

  // templates category (group wise)
  const categorizeTemplates = () => {
    // categorize by element types used
    return templates.reduce((acc, template) => {
      const hasCalculation = template.fields.some(f => 
        f.type === 'calculation_display' || f.type === 'number_input'
      );
      const category = hasCalculation ? 'calculators' : 'forms';
      
      if (!acc[category]) acc[category] = [];
      acc[category].push(template);
      return acc;
    }, {});
  };

  const categorizedTemplates = categorizeTemplates();
  const categories = Object.keys(categorizedTemplates);

  // filter templates based on search and category
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = 
      (template.templateName || template.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.templateDescription?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (categoryFilter === "all") return matchesSearch;
    
    const templateCategory = template.fields.some(f => 
      f.type === 'calculation_display' || f.type === 'number_input'
    ) ? 'calculators' : 'forms';
    
    return matchesSearch && templateCategory === categoryFilter;
  });

  const handleUseTemplate = (templateId) => {
    const formData = new FormData();
    formData.append("actionType", "duplicateTemplate");
    formData.append("templateId", templateId);
    fetcher.submit(formData, { method: "post" });
  };

  const handleDeleteTemplate = (templateId, templateName) => {
    if (confirm(`Are you sure you want to delete "${templateName}" template? This action cannot be undone.`)) {
      setDeletingTemplateId(templateId);
      const formData = new FormData();
      formData.append("actionType", "deleteTemplate");
      formData.append("templateId", templateId);
      fetcher.submit(formData, { method: "post" });
    }
  };

  
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.formId) {
      const editorType = fetcher.data.editorType || "plain";
      const route = editorType === "dnd" 
        ? `/app/form-builder-edit-dnd/${fetcher.data.formId}`
        : `/app/form-builder-edit/${fetcher.data.formId}`;
      navigate(route);
    }
  }, [fetcher.data, navigate]);

  // clear deleting state after successful deletion
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.message) {
      setDeletingTemplateId(null);
    }
  }, [fetcher.data]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📋 Calculator Templates Library</h1>
          <p style={styles.subtitle}>
            Ready-to-use price calculator templates to get you started quickly
          </p>
        </div>
        <button
          onClick={() => navigate("/app/form-builder")}
          style={styles.backButton}
        >
          ← Back to Forms
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>⭐</div>
          <div>
            <div style={styles.statNumber}>{templates.length}</div>
            <div style={styles.statLabel}>Total Templates</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🧮</div>
          <div>
            <div style={styles.statNumber}>
              {categorizedTemplates.calculators?.length || 0}
            </div>
            <div style={styles.statLabel}>Calculator Templates</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📝</div>
          <div>
            <div style={styles.statNumber}>
              {categorizedTemplates.forms?.length || 0}
            </div>
            <div style={styles.statLabel}>Form Templates</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={styles.filterSection}>
        <div style={styles.filterTabs}>
          <button
            onClick={() => setCategoryFilter("all")}
            style={{
              ...styles.filterTab,
              ...(categoryFilter === "all" ? styles.filterTabActive : {}),
            }}
          >
            All Templates ({templates.length})
          </button>
          <button
            onClick={() => setCategoryFilter("calculators")}
            style={{
              ...styles.filterTab,
              ...(categoryFilter === "calculators" ? styles.filterTabActive : {}),
            }}
          >
            🧮 Calculators ({categorizedTemplates.calculators?.length || 0})
          </button>
          <button
            onClick={() => setCategoryFilter("forms")}
            style={{
              ...styles.filterTab,
              ...(categoryFilter === "forms" ? styles.filterTabActive : {}),
            }}
          >
            📝 Forms ({categorizedTemplates.forms?.length || 0})
          </button>
        </div>

        <input
          type="text"
          placeholder="🔍 Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📋</div>
          <h3 style={{ color: "#6b7280", marginBottom: 8 }}>
            {searchQuery ? "No templates found" : "No templates yet"}
          </h3>
          <p style={{ color: "#9ca3af", marginBottom: 24 }}>
            {searchQuery 
              ? "Try adjusting your search query" 
              : "Save your first form as a template to see it here"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate("/app/form-builder")}
              style={styles.createButton}
            >
              Go to Forms
            </button>
          )}
        </div>
      ) : (
        <>
          {deletingTemplateId && (
            <div style={styles.deletingBanner}>
              <span>🗑️ Deleting template...</span>
            </div>
          )}
          <div style={styles.templatesGrid}>
            {filteredTemplates.map((template) => {
              const isDeleting = deletingTemplateId === template.id;
              const hasCalculation = template.fields.some(f => 
                f.type === 'calculation_display' || f.type === 'number_input'
              );

              return (
                <div 
                  key={template.id} 
                  style={{
                    ...styles.templateCard,
                    opacity: isDeleting ? 0.5 : 1,
                    pointerEvents: isDeleting ? "none" : "auto"
                  }}
                >
                  {/* Template Badge */}
                  <div style={styles.templateBadge}>
                    {hasCalculation ? "🧮 Calculator" : "📝 Form"}
                  </div>

                  {/* Template Info */}
                  <div style={styles.templateCardContent}>
                    <h3 style={styles.templateCardTitle}>
                      {template.templateName || template.name}
                    </h3>
                    
                    {template.templateDescription && (
                      <p style={styles.templateCardDescription}>
                        {template.templateDescription}
                      </p>
                    )}

                    <div style={styles.templateCardMeta}>
                      <span style={styles.metaItem}>
                        📊 {template.fields?.length || 0} elements
                      </span>
                      <span style={styles.metaItem}>
                        {template.description === "dnd" ? "✨ DnD" : "🎯 Plain"}
                      </span>
                      <span style={styles.metaItem}>
                        🕒 {new Date(template.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Element Types Preview */}
                    {template.fields.length > 0 && (
                      <div style={styles.elementPreview}>
                        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>
                          INCLUDES:
                        </span>
                        <div style={styles.elementTags}>
                          {[...new Set(template.fields.map(f => f.type))]
                            .slice(0, 4)
                            .map(type => (
                              <span key={type} style={styles.elementTag}>
                                {type.replace(/_/g, ' ')}
                              </span>
                            ))}
                          {[...new Set(template.fields.map(f => f.type))].length > 4 && (
                            <span style={styles.elementTag}>
                              +{[...new Set(template.fields.map(f => f.type))].length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={styles.templateCardActions}>
                    <button
                      onClick={() => handleUseTemplate(template.id)}
                      style={styles.actionButtonPrimary}
                      disabled={isDeleting}
                      title="Use this template"
                    >
                      ✨ Use Template
                    </button>

                    <button
                      onClick={() => navigate(`/app/form-builder-preview/${template.id}`)}
                      style={styles.actionButton}
                      disabled={isDeleting}
                      title="Preview Template"
                    >
                      👁️ Preview
                    </button>

                    <button
                      onClick={() => {
                        const editorType = template.description || "plain";
                        const route = editorType === "dnd" 
                          ? `/app/form-builder-edit-dnd/${template.id}`
                          : `/app/form-builder-edit/${template.id}`;
                        navigate(route);
                      }}
                      style={styles.actionButton}
                      disabled={isDeleting}
                      title="Edit Template"
                    >
                      ✏️ Edit
                    </button>

                    <button
                      onClick={() => handleDeleteTemplate(template.id, template.templateName || template.name)}
                      style={styles.actionButtonDanger}
                      disabled={isDeleting}
                      title="Delete Template"
                    >
                      {isDeleting ? "..." : "🗑️"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Help Section */}
      <div style={styles.helpSection}>
        <div style={styles.helpCard}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💡</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600 }}>
            How to Create Templates
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
            Create a form with all the elements you need, then save it as a template 
            from the preview page. Templates can be reused to quickly create new calculators.
          </p>
          <button
            onClick={() => navigate("/app/form-builder")}
            style={{ ...styles.actionButton, marginTop: 16, width: "100%" }}
          >
            Create Your First Form
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Styles ====================
const styles = {
  container: {
    padding: "24px",
    background: "#f9fafb",
    minHeight: "100vh",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },

  title: {
    margin: "0 0 8px 0",
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
  },

  subtitle: {
    margin: 0,
    fontSize: 14,
    color: "#6b7280",
  },

  backButton: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    background: "#fff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 500,
    transition: "all 0.2s",
  },

  createButton: {
    padding: "12px 24px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#0ea5a4",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    transition: "all 0.2s",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },

  statCard: {
    background: "#fff",
    borderRadius: 12,
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    border: "1px solid #e5e7eb",
  },

  statIcon: {
    fontSize: 32,
  },

  statNumber: {
    fontSize: 24,
    fontWeight: 700,
    color: "#111827",
  },

  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },

  filterSection: {
    background: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
  },

  filterTabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  filterTab: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    color: "#6b7280",
    transition: "all 0.2s",
  },

  filterTabActive: {
    background: "#eff6ff",
    borderColor: "#3b82f6",
    color: "#3b82f6",
  },

  searchInput: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    fontSize: 14,
    minWidth: 300,
    outline: "none",
  },

  deletingBanner: {
    padding: 12,
    background: "#fef3c7",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: "#92400e",
    marginBottom: 16,
    textAlign: "center",
  },

  emptyState: {
    textAlign: "center",
    padding: "80px 20px",
    background: "#fff",
    borderRadius: 12,
    border: "2px dashed #e5e7eb",
  },

  templatesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
    gap: 24,
    marginBottom: 32,
  },

  templateCard: {
    background: "#fff",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    position: "relative",
    transition: "all 0.2s",
    border: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
  },

  templateBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: "4px 12px",
    borderRadius: 20,
    background: "#fef3c7",
    border: "1px solid #fcd34d",
    fontSize: 11,
    fontWeight: 600,
    color: "#92400e",
  },

  templateCardContent: {
    flex: 1,
    marginBottom: 16,
  },

  templateCardTitle: {
    margin: "0 0 8px 0",
    fontSize: 18,
    fontWeight: 600,
    color: "#111827",
    paddingRight: 100, // Space for badge
  },

  templateCardDescription: {
    margin: "0 0 12px 0",
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 1.5,
  },

  templateCardMeta: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 12,
  },

  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },

  elementPreview: {
    marginTop: 12,
    padding: 12,
    background: "#f9fafb",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
  },

  elementTags: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 6,
  },

  elementTag: {
    padding: "2px 8px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    color: "#1e40af",
    textTransform: "capitalize",
  },

  templateCardActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    paddingTop: 16,
    borderTop: "1px solid #f3f4f6",
  },

  actionButtonPrimary: {
    flex: 1,
    minWidth: "fit-content",
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: "#059669",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.2s",
  },

  actionButton: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    background: "#fff",
    color: "#374151",
    fontSize: 13,
    fontWeight: 500,
    transition: "all 0.2s",
  },

  actionButtonDanger: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #fee2e2",
    cursor: "pointer",
    background: "#fff",
    color: "#dc2626",
    fontSize: 13,
    fontWeight: 500,
    transition: "all 0.2s",
  },

  helpSection: {
    marginTop: 32,
  },

  helpCard: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: 24,
    textAlign: "center",
  },
};