import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLoaderData, useNavigate, useFetcher} from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response";
import { CalculatorEngine } from "../utils/calculator";


// ==================== LOADER ====================
//fetch form data when preview page loads
//same as edit file loader
export const loader = async ({ request, params }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;
    const formId = params.formId;

    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await prisma.form.findFirst({
      where: { id: formId, shop },
      include: { fields: { orderBy: { order: "asc" } } },
    });

    if (!form) {
      return json({ error: "Form not found" }, { status: 404 });
    }

    return json({ form });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
};

// ==================== ACTION ====================
//handle form submissions(save as template)
export const action = async ({ request, params }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;
    const formId = params.formId;

    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "saveAsTemplate") {
      const templateName = formData.get("templateName");
      const templateDescription = formData.get("templateDescription");

      if (!templateName?.trim()) {
        return json({ success: false, error: "Template name is required" }, { status: 400 });
      }

      await prisma.form.update({
        where: { id: formId, shop },
        data: {
          isTemplate: true,
          templateName: templateName.trim(),
          templateDescription: templateDescription?.trim() || "",
          updatedAt: new Date(),
        },
      });

      return json({ 
        success: true, 
        message: "Template saved successfully",
        action: "saveAsTemplate"
      });
    }
    
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
};

// ==================== UTILITY ====================

function safeJSONParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}


//===============main component==================
export default function FormBuilderPreview(){
  const {form } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  //control save as template modal

  const [savedAsTemplate, setSavedAsTemplate] = useState(form?.isTemplate || false);
  //track if already saved as template

  //load components
  //parse database fields into component objectss
  //same logic as edit file but stored in state( not useState callback)

  const [components] = useState(()=>{
    const fields = form?.fields || [];
    return fields.map((f) => {
      const parsedOptions = f.options ? safeJSONParse(f.options, {}) : {};
      const parsedMetadata = f.metadata ? safeJSONParse(f.metadata, {}) : {};
      
      const baseComponent = {
        id: f.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder || "",
        required: !!f.required,
        styles: parsedOptions,
        tooltip: parsedMetadata.tooltip || {enabled: false, text: ""},
        conditionalDisplay: parsedMetadata.conditionalDisplay || {
          enabled: false,
          valueWhenNotDisplayed: "1",
          triggerElementId: null,
        },
        additionalInfo: parsedMetadata.additionalInfo || "",
      };

      //parse element-specific data based on type
      switch(f.type){
        case "heading":
          return {
            ...baseComponent,
            content: parsedMetadata.content || {text: "Form Heading"},
          };

          case "dropdown":
            return {
              ...baseComponent,
              options: parsedMetadata.options || [
                { id: 1, name: "Option 1", value: "0"},
                { id: 2, name: "Option 2", value: "0"},
              ],
            };

          case "radio":
            return {
              ...baseComponent,
              options: parsedMetadata.options || [
                {id: 1, name: "Option 1", value: "0"},
                {id: 2, name: "Option 2", value: "0"},
              ],
            };

            case "image_selector":
              return {
                ...baseComponent,
                options: parsedMetadata.options || [],
                settings: parsedMetadata.settings || {
                  enableSwatch: true,
                  showImageOnSelection: false,
                },
              };

            case "data_lookup":
              return {
                ...baseComponent,
                settings: parsedMetadata.settings || {},
                tableData: parsedMetadata.tableData || null,
              };
            
              case "number_input":
                return {
                  ...baseComponent,
                  settings: parsedMetadata.settings || {},
                  valueRanges: parsedMetadata.valueRanges || [],
                };

            case "text_block":
              return {
                ...baseComponent,
                content: parsedMetadata.content || {heading: "", richText: ""},
              };

            case "text_input":
              return {
                ...baseComponent,
                settings: parsedMetadata.settings || {},
              };
            
            case "checkbox":
              return {
                ...baseComponent,
                settings: parsedMetadata.settings || {},
                options: parsedMetadata.options || [],
              };

            case "calculation_display":
              return {
                ...baseComponent,
                settings: parsedMetadata.settings || {},
              };

          case "photo_editor":
            return {
              ...baseComponent,
              settings: parsedMetadata.settings || { required: false},
              buttonStyle: parsedMetadata.buttonStyle || {
                buttonText: "Edit",
                bgColor: "#000000",
                textColor: "#ffffff",
              },
            };

          case "file_upload":
            return {
              ...baseComponent,
              settings: parsedMetadata.settings || {required: false},
            };

          default:
            return baseComponent;
      }
    });
  });

  //load formula settings
  const [formulaSettings] = useState(() => {
    if(form?.formulaSettings){
      const parsed = safeJSONParse(form.formulaSettings, null);
      return parsed || {
        formula: "",
        formulaLabel: "",
        minFormulaValue: "0",
        formulaDecimals: "2",
        formulaPrefix: "",
        formulaSuffix: "",
      };
    }

    return {
      formula: "",
      formulaLabel: "",
      minFormulaValue: "0",
      formulaDecimals: "2",
      formulaPrefix: "",
      formulaSuffix: "",
    };
  });

  //initialize calculator
  //create calculator instance for real-time calculations
  //useMemo prevents recreating on every render

  const calculator = useMemo(
    () => new CalculatorEngine(components, formulaSettings),
    [components, formulaSettings]
  );
  //useMemo caches calclator instance
  //only recreates if components or formulaSettings change

  //state management
  const [formValues, setFormValues] = useState({});
  //store all use input values
  //object like {elementId: value, ...}

  const [calculatedPrice, setCalculatedPrice] = useState(0);
  //store current calculated total price
  //number updated on every form value change

  //auto-calculate on change
  //recalculation price whenever user changes any input

  useEffect(()=> {
    const price = calculator.calculateFinalPrice(formValues);
    setCalculatedPrice(price);
  }, [formValues, calculator]);
  //useEffect runs when formValues or calculator changes
  //keeps calculatedPrice in sync with input

  ///========handlers===================
  const handleValueChange = (elementId, value) => {
    setFormValues(prev => ({
      ...prev,
      [elementId]: value
    }));

    //update single form value
    //spread previus values, update changed field
    //useEffect above to recalculate
  };

  const getCalculatedValue = (component) => {
    if(component.type !== "calculation_display") return 0;
    //only calculation_display elements show formula

    const result = calculator.evaluateFormula(component.settings?.formula || "", formValues);
    //calculate this element's formula

    const decimals = parseInt(component.settings?.formulaDecimal) || 0;
    return parseFloat(result.toFixed(decimals));
    //round to specified decimals
  };

  const isElementVisible = (component)=>{
    return calculator.isElementVisible(component, formValues);
    //check conditional display rules
    //return true/false based on trigger element
  };

  const handleSaveAsTemplate = (templateName, templateDescription) => {
    const formData = new FormData();
    formData.append("actionType", "saveAsTemplate");
    formData.append("templateName", templateName);
    formData.append("templateDescription", templateDescription);

    fetcher.submit(formData, {method: "post"});
    //submit to action function above
  };

  //effect: template save success
  useEffect(() => {
    if(fetcher.data?.success && fetcher.data?.action === "saveAsTemplate"){
      setSavedAsTemplate(true);
       setShowTemplateModal(false);
      alert("Template saved successfully!");
    }
  }, [fetcher.data]);
  //show feedback when save completes

  const isSubmitting = fetcher.state === "submitting";
  //show loading state during submission


  //===================render=========================
  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/app/form-builder")} 
            style={styles.backButton}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            ← Back
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {savedAsTemplate ? (
            <button 
              onClick={() => navigate("/app/form-templates")}
              style={styles.templateBtn}
            >
              📋 View in Templates
            </button>
          ) : (
            <button 
              onClick={() => setShowTemplateModal(true)}
              style={styles.saveTemplateBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : " Save as Template 📋"}
            </button>
          )}

          <button
            onClick={() => navigate(`/app/form-builder-edit/${form.id}`)}
            style={styles.editButton}
          >
            ✍🏻 Edit Form
          </button>
        </div>
      </div>

      {/* ==================== TEMPLATE MODAL ==================== */}

      <SaveAsTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSave={handleSaveAsTemplate}
        currentFormName={form?.name || ""}
        isSubmitting={isSubmitting}
      />

      {/*===============preview====================*/}

      <div style={styles.previewContainer}>
        <div style={styles.formPreview}>
          {/* ==================== FORM HEADER ==================== */}
          <div style={styles.formHeader}>
            <h1 style={styles.formTitle}>{form?.name || "Untitled Form"}</h1>
            
            {formulaSettings.formulaLabel && (
              <div style={styles.formulaDisplay}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>
                  {formulaSettings.formulaLabel}:
                </span>
                <span style={{ fontSize: 28, fontWeight: 700, color: "#059669" }}>
                  {calculator.formatPrice(calculatedPrice)}
                </span>
              </div>
            )}
            {/* Show live calculated price at top */}
          </div>

          {/* ==================== FORM ELEMENTS ==================== */}
          {components.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <h3>No elements in this form</h3>
              <p>Add elements in the editor to see them here</p>
            </div>
          ) : (
            <div style={styles.elementsContainer}>
              {components.map((component, index) => {
                //CONDITIONAL DISPLAY CHECk
                if (!isElementVisible(component)) {
                  return null;
                  // Don't render hidden elements
                }

                return (
                  <div key={component.id || index} style={styles.elementWrapper}>
                    <RenderComponent 
                      component={component} 
                      value={formValues[component.id]}
                      onChange={(value) => handleValueChange(component.id, value)}
                      calculatedValue={getCalculatedValue(component)}
                      formValues={formValues}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {components.length > 0 && (
            <div style={styles.submitSection}>
              <button 
                style={styles.submitButton}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#047857";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 12px rgba(5, 150, 105, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#059669";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(5, 150, 105, 0.25)";
                }}
                onClick={() => {
                
                  console.log("Form Values:", formValues);
                  console.log("Calculated Price:", calculatedPrice);
                  alert(`Total Price: ${calculator.formatPrice(calculatedPrice)}\n\nForm Data: ${JSON.stringify(formValues, null, 2)}`);
                }}
              >
                Add to Cart - {calculator.formatPrice(calculatedPrice)}
              </button>
            </div>
          )}
          </div>
      </div>
    </div>
  )
}

// ==================== RENDER COMPONENT ====================
function RenderComponent({ component = {}, value, onChange, calculatedValue, formValues }) {
  const {
    type,
    label,
    required,
    styles: compStyles = {},
    options = [],
    tooltip = {},
    settings = {},
    content = {},
    buttonStyle = {},
    tableData = null,
  } = component;

  // ==================== HELPERS ====================
  const renderTooltip = () => {
    if (tooltip?.enabled && tooltip?.text) {
      return (
        <span 
          title={tooltip.text} 
          style={{ 
            marginLeft: 8, 
            fontWeight: 700, 
            cursor: "help",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#e0e7ff",
            color: "#4f46e5",
            fontSize: 12,
          }}
        >
          ?
        </span>
      );
    }
    return null;
  };

  const getLabelStyles = () => ({
    display: "flex",
    alignItems: "center",
    marginBottom: 8,
    fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
    fontSize: compStyles?.fontSize || "14px",
    fontWeight: compStyles?.fontWeight || "500",
    lineHeight: compStyles?.lineHeight || "1.5",
    letterSpacing: compStyles?.letterSpacing || "0px",
    color: compStyles?.textColor || "#374151",
    textAlign: compStyles?.textAlign || "left",
  });

  const getFieldStyles = () => ({
    width: "100%",
    height: compStyles?.height || "40px",
    background: compStyles?.bgColor || "#fff",
    border: `${compStyles?.borderWidth || "1px"} solid ${compStyles?.borderColor || "#e5e7eb"}`,
    borderRadius: compStyles?.borderRadius || "6px",
    padding: compStyles?.padding || "8px 12px",
    fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
    fontSize: compStyles?.fontSize || "14px",
    fontWeight: compStyles?.fontWeight || "400",
    color: compStyles?.textColor || "#374151",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  });

  const renderLabel = (text, showRequired = true) => (
    <label style={getLabelStyles()}>
      {text}
      {showRequired && required && <span style={{ color: "#dc2626", marginLeft: 6 }}>*</span>}
      {renderTooltip()}
    </label>
  );

  // ==================== COMPONENT RENDERERS ====================
  switch (type) {
    case "heading":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          padding: compStyles?.padding || "20px 0",
          background: compStyles?.bgColor || "transparent",
          marginBottom: compStyles?.marginBottom || "24px",
          textAlign: compStyles?.textAlign || "left",
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
            fontSize: compStyles?.fontSize || "32px",
            fontWeight: compStyles?.fontWeight || "700",
            lineHeight: compStyles?.lineHeight || "1.2",
            letterSpacing: compStyles?.letterSpacing || "0px",
            color: compStyles?.textColor || "#1f2937",
          }}>
            {content?.text || "Form Heading"}
          </h1>
          {renderTooltip()}
        </div>
      );

    case "dropdown":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label)}
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
              e.currentTarget.style.boxShadow = "none";
            }}
            style={{
              ...getFieldStyles(),
              cursor: "pointer",
            }}
          >
            <option value="">{component?.placeholder || "Select an option..."}</option>
            {options?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      );

    case "image_selector":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label)}
          {settings?.enableSwatch ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {options?.map((o) => (
                <label
                  key={o.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: 8,
                    background: value === o.id ? "#dbeafe" : "#f9fafb",
                    borderRadius: 6,
                    border: value === o.id ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                    cursor: "pointer",
                    minWidth: 80,
                    transition: "all 0.2s",
                  }}
                  onClick={() => onChange(o.id)}
                  onMouseEnter={(e) => {
                    if (value !== o.id) {
                      e.currentTarget.style.borderColor = "#d1d5db";
                      e.currentTarget.style.background = "#f3f4f6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (value !== o.id) {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.background = "#f9fafb";
                    }
                  }}
                >
                  {o.image ? (
                    <img 
                      src={o.image} 
                      alt={o.name} 
                      style={{ 
                        width: 60, 
                        height: 60, 
                        objectFit: "cover", 
                        borderRadius: 4,
                        border: "1px solid #d1d5db"
                      }} 
                    />
                  ) : (
                    <div style={{ 
                      width: 60, 
                      height: 60, 
                      background: "#f3f4f6", 
                      borderRadius: 4, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      fontSize: 24,
                      color: "#9ca3af"
                    }}>
                      🖼️
                    </div>
                  )}
                  <span style={{ 
                    fontSize: 12, 
                    textAlign: "center",
                    fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
                    fontWeight: value === o.id ? 600 : 400,
                  }}>
                    {o.name}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <select 
              value={value || ""} 
              onChange={(e) => onChange(e.target.value)} 
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
                e.currentTarget.style.boxShadow = "none";
              }}
              style={getFieldStyles()}
            >
              <option value="">Select an option...</option>
              {options?.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
        </div>
      );

    case "number_input":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label)}
          <input
            type="number"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
              e.currentTarget.style.boxShadow = "none";
            }}
            placeholder={component?.placeholder || "Enter number"}
            min={settings?.minValue || 0}
            max={settings?.maxValue || 10000}
            step={settings?.maxDecimal > 0 ? `0.${'0'.repeat(settings.maxDecimal - 1)}1` : 1}
            style={{
              ...getFieldStyles(),
              cursor: "text",
            }}
          />
          {settings?.useAsQuantity && (
            <div style={{ 
              marginTop: 6, 
              fontSize: 12, 
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              <span style={{ fontSize: 14 }}>ℹ️</span>
              <span>This will be used as product quantity</span>
            </div>
          )}
        </div>
      );

    case "text_block":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          padding: compStyles?.padding || "20px 0",
          background: compStyles?.bgColor || "transparent",
          marginBottom: compStyles?.marginBottom || "24px",
          textAlign: compStyles?.textAlign || "left",
        }}>
          {content?.heading && (
            <h3 style={{
              margin: "0 0 12px 0",
              fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
              fontSize: compStyles?.fontSize || "20px",
              fontWeight: compStyles?.fontWeight || "600",
              lineHeight: compStyles?.lineHeight || "1.4",
              letterSpacing: compStyles?.letterSpacing || "0px",
              color: compStyles?.textColor || "#374151",
            }}>
              {content.heading}
            </h3>
          )}
          {content?.richText ? (
            <div style={{
              whiteSpace: "pre-wrap",
              fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
              fontSize: compStyles?.fontSize || "14px",
              fontWeight: compStyles?.fontWeight || "400",
              lineHeight: compStyles?.lineHeight || "1.6",
              letterSpacing: compStyles?.letterSpacing || "0px",
              color: compStyles?.textColor || "#374151",
            }}>
              {content.richText}
            </div>         
          ) : (
            <div style={{ fontStyle: "italic", color: "#9ca3af" }}>
              No content added yet
            </div>
          )}
          {renderTooltip()}
        </div>
      );

    case "text_input":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label)}
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
              e.currentTarget.style.boxShadow = "none";
            }}
            placeholder={component?.placeholder || settings?.placeholder || "Enter text"}
            maxLength={settings?.maxCharacters || 50}
            style={{
              ...getFieldStyles(),
              cursor: "text",
            }}
          />
          {settings?.maxCharacters && (
            <div style={{ 
              marginTop: 4, 
              fontSize: 12, 
              color: "#6b7280", 
              textAlign: "right",
              fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
            }}>
              <span style={{ 
                color: (value || "").length >= settings.maxCharacters ? "#dc2626" : "#6b7280",
                fontWeight: (value || "").length >= settings.maxCharacters ? 600 : 400,
              }}>
                {(value || "").length}
              </span> / {settings.maxCharacters} characters
              {settings?.includeSpaceInLength && " (including spaces)"}
            </div>
          )}
        </div>
      );

    case "checkbox":
      if (settings?.multipleSelection) {
        return (
          <div style={{
            width: compStyles?.width || "100%",
            marginBottom: compStyles?.marginBottom || "16px",
          }}>
            <label style={getLabelStyles()}>
              {label}
              {settings?.required && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
              {renderTooltip()}
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {options?.map((opt) => (
                <label
                  key={opt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: compStyles?.padding || "10px",
                    background: compStyles?.bgColor || "#f9fafb",
                    borderRadius: compStyles?.borderRadius || "6px",
                    border: `${compStyles?.borderWidth || "1px"} solid ${compStyles?.borderColor || "#e5e7eb"}`,
                    cursor: "pointer",
                    fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
                    fontSize: compStyles?.fontSize || "14px",
                    fontWeight: compStyles?.fontWeight || "400",
                    lineHeight: compStyles?.lineHeight || "1.5",
                    letterSpacing: compStyles?.letterSpacing || "0px",
                    color: compStyles?.textColor || "#374151",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f3f4f6";
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = compStyles?.bgColor || "#f9fafb";
                    e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(value || []).includes(opt.id)}
                    onChange={(e) => {
                      const currentValue = value || [];
                      const newValue = e.target.checked
                        ? [...currentValue, opt.id]
                        : currentValue.filter(id => id !== opt.id);
                      onChange(newValue);
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  <span>{opt.name}</span>
                </label>
              ))}
            </div>
          </div>
        );
      } else {
        return (
          <div style={{
            width: compStyles?.width || "100%",
            marginBottom: compStyles?.marginBottom || "16px",
          }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: compStyles?.padding || "12px",
                background: compStyles?.bgColor || "#ffffff",
                borderRadius: compStyles?.borderRadius || "6px",
                border: `${compStyles?.borderWidth || "1px"} solid ${compStyles?.borderColor || "#e5e7eb"}`,
                cursor: "pointer",
                fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
                fontSize: compStyles?.fontSize || "14px",
                fontWeight: compStyles?.fontWeight || "500",
                lineHeight: compStyles?.lineHeight || "1.5",
                letterSpacing: compStyles?.letterSpacing || "0px",
                color: compStyles?.textColor || "#374151",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f9fafb";
                e.currentTarget.style.borderColor = "#d1d5db";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = compStyles?.bgColor || "#ffffff";
                e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
              }}
            >
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => onChange(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>
                {label}
                {settings?.required && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
              </span>
              {renderTooltip()}
            </label>
          </div>
        );
      }

    case "file_upload":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label, settings?.required)}
          <div style={{
            width: "100%",
            minHeight: compStyles?.height || "80px",
            background: compStyles?.bgColor || "#fff",
            border: `${compStyles?.borderWidth || "2px"} dashed ${compStyles?.borderColor || "#e5e7eb"}`,
            borderRadius: compStyles?.borderRadius || "6px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 12,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3b82f6";
            e.currentTarget.style.background = "#eff6ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
            e.currentTarget.style.background = compStyles?.bgColor || "#fff";
          }}
          >
            <div style={{ fontSize: 32 }}>📤</div>
            <div style={{ 
              fontSize: 14, 
              color: compStyles?.textColor || "#6b7280", 
              textAlign: "center",
              fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
            }}>
              <strong style={{ color: "#374151" }}>Click to upload</strong> or drag and drop
              <br />
              <span style={{ fontSize: 12 }}>PNG, JPG, PDF up to 10MB</span>
            </div>
          </div>
        </div>
      );

    case "photo_editor":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label, settings?.required)}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={{
                padding: "8px 16px",
                background: buttonStyle?.bgColor || "#000",
                color: buttonStyle?.textColor || "#fff",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
                fontSize: compStyles?.fontSize || "14px",
                fontWeight: compStyles?.fontWeight || "500",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              {buttonStyle?.buttonText || "Edit"}
            </button>
            <div style={{ 
              fontSize: 12, 
              color: compStyles?.textColor || "#6b7280",
              fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
            }}>
              Upload & edit photo
            </div>
          </div>
        </div>
      );

    case "calculation_display":
      const prefix = settings?.formulaPrefix || "";
      const suffix = settings?.formulaSuffix || "";
      const decimals = parseInt(settings?.formulaDecimal) || 0;

      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label, false)}
          <div style={{
            ...getFieldStyles(),
            display: "flex",
            alignItems: "center",
            fontWeight: compStyles?.fontWeight || "600",
            fontSize: compStyles?.fontSize || "18px",
            background: "#f0fdf4",
            border: "2px solid #86efac",
            color: "#059669",
            minHeight: "48px",
          }}>
            {prefix && <span style={{ marginRight: 4 }}>{prefix}</span>}
            <span style={{ fontWeight: 700 }}>{calculatedValue.toFixed(decimals)}</span>
            {suffix && <span style={{ marginLeft: 4 }}>{suffix}</span>}
          </div>
          {settings?.useAsQuantity && (
            <div style={{ 
              marginTop: 6, 
              fontSize: 12, 
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              <span style={{ fontSize: 14 }}>ℹ️</span>
              <span>Result will be used as product quantity</span>
            </div>
          )}
        </div>
      );

    case "data_lookup":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label)}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ 
                display: "block", 
                marginBottom: 6, 
                fontSize: 13, 
                fontWeight: 500,
                fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
                color: compStyles?.textColor || "#374151",
              }}>
                {settings?.input1Name || "Input 1"}
              </label>
              <input
                type="number"
                placeholder="Enter value"
                value={formValues[`${component.id}_input1`] || ""}
                onChange={(e) => onChange({ ...formValues, [`${component.id}_input1`]: e.target.value })}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
                  e.currentTarget.style.boxShadow = "none";
                }}
                style={{
                  ...getFieldStyles(),
                  height: "36px",
                  cursor: "text",
                }}
              />
            </div>
            <div>
              <label style={{ 
                display: "block", 
                marginBottom: 6, 
                fontSize: 13, 
                fontWeight: 500,
                fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
                color: compStyles?.textColor || "#374151",
              }}>
                {settings?.input2Name || "Input 2"}
              </label>
              <input
                type="number"
                placeholder="Enter value"
                value={formValues[`${component.id}_input2`] || ""}
                onChange={(e) => onChange({ ...formValues, [`${component.id}_input2`]: e.target.value })}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
                  e.currentTarget.style.boxShadow = "none";
                }}
                style={{
                  ...getFieldStyles(),
                  height: "36px",
                  cursor: "text",
                }}
              />
            </div>
            {tableData && tableData.rows && tableData.rows.length > 0 && (
              <div style={{
                padding: 10,
                background: "#ecfdf5",
                border: "1px solid #6ee7b7",
                borderRadius: 6,
                fontSize: 12,
                color: "#065f46",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span style={{ fontSize: 16 }}>✓</span>
                <span>
                  <strong>Table data loaded:</strong> {tableData.fileName || "Custom table"} 
                  <span style={{ marginLeft: 4, color: "#059669" }}>
                    ({tableData.rows.length} rows)
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      );

    case "radio":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label)}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options?.map((o) => (
              <label
                key={o.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: compStyles?.padding || "8px",
                  background: compStyles?.bgColor || "#f9fafb",
                  borderRadius: compStyles?.borderRadius || "6px",
                  border: `${compStyles?.borderWidth || "1px"} solid ${compStyles?.borderColor || "#e5e7eb"}`,
                  cursor: "pointer",
                  fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
                  fontSize: compStyles?.fontSize || "14px",
                  fontWeight: compStyles?.fontWeight || "400",
                  lineHeight: compStyles?.lineHeight || "1.5",
                  letterSpacing: compStyles?.letterSpacing || "0px",
                  color: compStyles?.textColor || "#374151",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f3f4f6";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = compStyles?.bgColor || "#f9fafb";
                  e.currentTarget.style.borderColor = compStyles?.borderColor || "#e5e7eb";
                }}
              >
                <input
                  type="radio"
                  name={`radio-${component.id}`}
                  checked={value === o.id}
                  onChange={() => onChange(o.id)}
                  style={{ cursor: "pointer" }}
                />
                <span>{o.name}</span>
              </label>
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div style={{
          padding: 20,
          background: "#fef2f2",
          border: "2px dashed #fca5a5",
          borderRadius: 8,
          textAlign: "center",
          color: "#991b1b",
          fontFamily: "Inter, system-ui, sans-serif",
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
          <strong>Unknown element type:</strong> {type}
        </div>
      );
  }
}

// ==================== SAVE AS TEMPLATE MODAL ====================
function SaveAsTemplateModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentFormName,
  isSubmitting 
}) {
  const [templateName, setTemplateName] = useState(currentFormName);
  const [templateDescription, setTemplateDescription] = useState("");

  if (!isOpen) return null;

  const handleSave = () => {
    if (templateName.trim()) {
      onSave(templateName, templateDescription);
    }
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>⭐ Save as Template</h2>
          <button 
            onClick={onClose} 
            style={modalStyles.closeBtn}
            onMouseEnter={(e) => e.currentTarget.style.color = "#374151"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#6b7280"}
          >
            ×
          </button>
        </div>

        <div style={modalStyles.content}>
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>
              Template Name <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter template name..."
              style={modalStyles.input}
              autoFocus
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <div style={modalStyles.hint}>
              Choose a descriptive name for your template
            </div>
          </div>

          <div style={modalStyles.field}>
            <label style={modalStyles.label}>
              Description (Optional)
            </label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Describe what this template is for..."
              style={modalStyles.textarea}
              rows={4}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <div style={modalStyles.hint}>
              Help others understand when to use this template
            </div>
          </div>

          <div style={modalStyles.infoBox}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>💡</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <strong>What happens next?</strong>
              <br />
              Your form will be saved as a reusable template in the Templates Library. 
              You and your team can use it to quickly create new calculators.
            </div>
          </div>
        </div>

        <div style={modalStyles.actions}>
          <button 
            onClick={onClose} 
            style={modalStyles.cancelBtn}
            disabled={isSubmitting}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = "#f3f4f6";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = "#fff";
              }
            }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            style={{
              ...modalStyles.saveBtn,
              opacity: !templateName.trim() || isSubmitting ? 0.5 : 1,
              cursor: !templateName.trim() || isSubmitting ? "not-allowed" : "pointer",
            }}
            disabled={!templateName.trim() || isSubmitting}
            onMouseEnter={(e) => {
              if (templateName.trim() && !isSubmitting) {
                e.currentTarget.style.background = "#047857";
              }
            }}
            onMouseLeave={(e) => {
              if (templateName.trim() && !isSubmitting) {
                e.currentTarget.style.background = "#059669";
              }
            }}
          >
            {isSubmitting ? "Saving..." : "💾 Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== STYLES ====================
const styles = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    background: "#f9fafb",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
  },

  topBar: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    zIndex: 10,
  },

  backButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
    fontWeight: 500,
    padding: "6px 12px",
    borderRadius: 6,
    transition: "background 0.2s",
  },

  editButton: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: "#3b82f6",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    transition: "background 0.2s",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },

  saveTemplateBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: "#059669",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    transition: "background 0.2s",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },

  templateBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "1px solid #fde68a",
    cursor: "pointer",
    background: "#fffbeb",
    color: "#92400e",
    fontSize: 14,
    fontWeight: 500,
    transition: "all 0.2s",
  },

  previewContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "40px 20px",
    display: "flex",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)",
  },

  formPreview: {
    width: "100%",
    maxWidth: 800,
    background: "#fff",
    borderRadius: 12,
    padding: 40,
    boxShadow: "0 10px 25px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.03)",
    minHeight: "calc(100vh - 160px)",
  },

  formHeader: {
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: "2px solid #e5e7eb",
  },

  formTitle: {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 16,
    lineHeight: 1.2,
  },

  formulaDisplay: {
    padding: 16,
    background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
    borderRadius: 8,
    border: "1px solid #bae6fd",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 16,
    color: "#0369a1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },

  emptyState: {
    textAlign: "center",
    padding: "80px 40px",
    background: "#f9fafb",
    borderRadius: 12,
    border: "2px dashed #d1d5db",
  },

  elementsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },

  elementWrapper: {
    // No extra styling needed
  },

  submitSection: {
    marginTop: 40,
    paddingTop: 24,
    borderTop: "2px solid #e5e7eb",
    display: "flex",
    justifyContent: "center",
  },

  submitButton: {
    padding: "16px 40px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#059669",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    boxShadow: "0 4px 6px rgba(5, 150, 105, 0.25)",
    transition: "all 0.2s",
    minWidth: 200,
  },
};

const modalStyles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },

  modal: {
    background: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
  },

  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: "#111827",
  },

  closeBtn: {
    background: "transparent",
    border: "none",
    fontSize: 28,
    cursor: "pointer",
    color: "#6b7280",
    padding: "0 8px",
    lineHeight: 1,
    transition: "color 0.2s",
  },

  content: {
    padding: 24,
  },

  field: {
    marginBottom: 20,
  },

  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },

  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },

  hint: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },

  infoBox: {
    padding: 16,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    color: "#1e40af",
  },

  actions: {
    display: "flex",
    gap: 12,
    padding: "16px 24px",
    borderTop: "1px solid #e5e7eb",
    justifyContent: "flex-end",
  },

  cancelBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    transition: "background 0.2s",
  },

  saveBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    background: "#059669",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    transition: "background 0.2s",
  },
};
              