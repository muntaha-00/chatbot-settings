import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response.js";
import { defaultServerConditions } from "vite";

// ==================== DRAG ITEM TYPES ====================
const ItemTypes = {
  ELEMENT: "element",
  COMPONENT: "component",
};

// ==================== LOADER ====================
export const loader = async ({ request, params }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;
    const formId = params.formId;

    console.log("📋 Editor Loading - FormID:", formId, "Shop:", shop);

    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await prisma.form.findFirst({
      where: { id: formId, shop },
      include: { fields: { orderBy: { order: "asc" } } },
    });

    if (!form) {
      console.log("Form not found:", formId);
      return json({ error: "Form not found" }, { status: 404 });
    }

    console.log("✅ Form loaded successfully:", form.name);
    return json({ form });
  } catch (error) {
    console.error("Error loading form:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

// ==================== COMPONENT DEFINITIONS ====================
const ELEMENTS = [
  { 
    type: "dropdown", 
    icon: "🔽", 
    label: "Dropdown",
    description: "Select one value from a list of options",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
    },
    defaultOptions: [
      {id: 1, name: "Option 1", value: "0"},
      {id: 2, name: "Option 2", value: "0"}
    ],
    defaultTooltip: {
      enabled: false,
      text: ""
    }
  },
  { 
    type: "image", 
    icon: "🖼️", 
    label: "Image Selector",
    description: "Select an image from a list/swatch",
    defaultStyles: {
      fontSize: "14px",
      color: "#666666",
      lineHeight: "1.6",
      textAlign: "left",
    }
  },
  { 
    type: "number", 
    icon: "🔢", 
    label: "Number Input",
    description: "Insert numbers with thresholds",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
    }
  },
  { 
    type: "data", 
    icon: "⌨", 
    label: "Data Lookup",
    description: "Look up a value from a table based on two options",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
      
    }
  },
  {
    type: "radio",
    icon: "◉",
    label: "Radio",
    description: "Select one value from a list of options",
    defaultStyles:{
      width: "100%",
      height:"40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",

    }
  },
  {
    type: "text",
    icon: "🖹",
    label: "Text BLobk",
    description: "Display any text",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderWidth: "6px",
    }
  },
  {
    type: "files",
    icon: "📁",
    label: "File Upload",
    description: "Upload Local Files",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
    }
  },
  {
    type: "photo",
    icon: "✎",
    label: "Photo Editor",
    description: "Upload and edit uploaded images",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
    }
  },

  {
    type: "text",
    icon: "🔤",
    label: "Text Input",
    description: "Insert any text",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderRadius: "6px",
      borderWidth: "1px",
    }
  },
  {
    type: "checkbox",
    icon: "☑️",
    label: "Checkbox",
    description: "A simple checkbox to make a binary choice",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderRadius: "6px",
      borderWidth: "1px",
    }
  },
  {
    type: "display",
    icon: "🧮",
    label: "Calculation Display",
    description: "Display a calculation based on inputs",
    defaultStyles: {
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
    },
  }
];

// ==================== FORM EDITOR ====================
export default function FormBuilderEditor() {
  const { form } = useLoaderData();

  return (
    <DndProvider backend={HTML5Backend}>
      <FormBuilderEditorContent form={form} />
    </DndProvider>
  );
}

function FormBuilderEditorContent({ form }) {
  const fetcher = useFetcher();
  const navigate = useNavigate();

  console.log("🎨 Editor Rendering - Form:", form?.name, "Fields:", form?.fields?.length);

  const [formName, setFormName] = useState(form.name);
  const [components, setComponents] = useState(
    form.fields.map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      placeholder: f.placeholder || "",
      required: f.required,
      styles: f.options ? JSON.parse(f.options) : {},
    }))
  );
  const [selectedComponentIndex, setSelectedComponentIndex] = useState(null);
  const [activeTab, setActiveTab] = useState("elements");
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  console.log("📦 Components loaded:", components.length);

  useEffect(() => {
    if (fetcher.data?.success) {
      setSaved(true);
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data]);

  // Add component from element
  const addComponent = (elementType) => {
    const elementDef = ELEMENTS.find(el => el.type === elementType);
    const newComponent = {
      id: `temp-${Date.now()}`,
      type: elementType,
      label: elementDef.label,
      placeholder: elementType === "text" ? "Enter value..." : "",
      required: false,
      styles: { ...elementDef.defaultStyles },
    };
    
    setComponents([...components, newComponent]);
    setSelectedComponentIndex(components.length);
    setActiveTab("properties");
  };

  // Move component
  const moveComponent = (dragIndex, hoverIndex) => {
    const newComponents = [...components];
    const [movedItem] = newComponents.splice(dragIndex, 1);
    newComponents.splice(hoverIndex, 0, movedItem);
    setComponents(newComponents);
  };

  const removeComponent = (index) => {
    setComponents(components.filter((_, i) => i !== index));
    setSelectedComponentIndex(null);
    setActiveTab("elements");
  };

  const updateComponent = (index, key, value) => {
    const newComponents = [...components];
    newComponents[index] = { ...newComponents[index], [key]: value };
    setComponents(newComponents);
  };

  const updateComponentStyle = (index, styleKey, value) => {
    const newComponents = [...components];
    newComponents[index].styles = {
      ...newComponents[index].styles,
      [styleKey]: value,
    };
    setComponents(newComponents);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("actionType", "update");
    formData.append("formId", form.id);
    formData.append("name", formName);
    formData.append("fields", JSON.stringify(components));
    fetcher.submit(formData, { method: "post", action: "/app/form-builder" });
  };

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <s-stack direction="horizontal" gap="base" alignment="center">
          <s-button onClick={() => navigate("/app/form-builder")} variant="secondary" size="slim">
            ← Back
          </s-button>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            style={styles.formNameInput}
            placeholder="Form Title"
          />
          <span style={{
            background: "#dbeafe",
            color: "#1e40af",
            padding: "4px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "600"
          }}>
            ✨ React DnD
          </span>
        </s-stack>

        <s-stack direction="horizontal" gap="tight" alignment="center">
          {saved && (
            <span style={{ color: "#047857", fontSize: "14px", fontWeight: "500" }}>
              ✓ Saved
            </span>
          )}
          <s-button 
            onClick={() => setShowPreview(!showPreview)} 
            variant="secondary"
            size="slim"
          >
            {showPreview ? "Edit" : "Preview"}
          </s-button>
          <s-button 
            onClick={handleSave} 
            disabled={fetcher.state === "submitting"}
            variant="primary"
            size="slim"
          >
            {fetcher.state === "submitting" ? "Saving..." : "Save"}
          </s-button>
        </s-stack>
      </div>

      {/* Main Editor */}
      <div style={styles.editorContainer}>
        {/* Canvas Area (65%) */}
        <CanvasArea
          components={components}
          showPreview={showPreview}
          selectedComponentIndex={selectedComponentIndex}
          onAddComponent={addComponent}
          onMoveComponent={moveComponent}
          onSelectComponent={(index) => {
            if (!showPreview) {
              setSelectedComponentIndex(index);
              setActiveTab("properties");
            }
          }}
          onRemoveComponent={removeComponent}
        />

        {/* Sidebar (35%) */}
        <div style={styles.sidebar}>
          {/* Tabs */}
          <div style={styles.sidebarTabs}>
            <button
              onClick={() => setActiveTab("elements")}
              style={{
                ...styles.tabButton,
                ...(activeTab === "elements" ? styles.tabButtonActive : {})
              }}
            >
              Elements
            </button>
            <button
              onClick={() => setActiveTab("properties")}
              disabled={selectedComponentIndex === null}
              style={{
                ...styles.tabButton,
                ...(activeTab === "properties" ? styles.tabButtonActive : {}),
                ...(selectedComponentIndex === null ? styles.tabButtonDisabled : {})
              }}
            >
              Properties
            </button>
          </div>

          {/* Tab Content */}
          <div style={styles.sidebarContent}>
            {activeTab === "elements" ? (
              <ElementsPanel onAddComponent={addComponent} />
            ) : (
              selectedComponentIndex !== null && (
                <PropertiesPanel
                  component={components[selectedComponentIndex]}
                  onUpdateLabel={(value) => updateComponent(selectedComponentIndex, "label", value)}
                  onUpdatePlaceholder={(value) => updateComponent(selectedComponentIndex, "placeholder", value)}
                  onUpdateRequired={(value) => updateComponent(selectedComponentIndex, "required", value)}
                  onUpdateStyle={(key, value) => updateComponentStyle(selectedComponentIndex, key, value)}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== CANVAS AREA ====================
function CanvasArea({ 
  components, 
  showPreview, 
  selectedComponentIndex,
  onAddComponent, 
  onMoveComponent, 
  onSelectComponent,
  onRemoveComponent 
}) {
  const [{ isOver }, drop] = useDrop({
    accept: [ItemTypes.ELEMENT, ItemTypes.COMPONENT],
    drop: (item) => {
      if (item.itemType === ItemTypes.ELEMENT) {
        onAddComponent(item.elementType);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div 
      ref={drop}
      style={{
        ...styles.canvasArea,
        background: isOver && !showPreview ? "#f0f9ff" : "#f9fafb",
      }}
    >
      <div style={styles.canvasContent}>
        {components.length === 0 ? (
          <div style={styles.dropZonePlaceholder}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <h3 style={{ marginBottom: "8px", color: "#374151" }}>Drag elements here</h3>
            <s-text style={{ color: "#9ca3af" }}>
              Start building your form by dragging elements from the sidebar
            </s-text>
          </div>
        ) : (
          <s-stack direction="vertical" gap="base">
            {components.map((component, index) => (
              <DraggableComponent
                key={component.id}
                component={component}
                index={index}
                isSelected={selectedComponentIndex === index}
                showPreview={showPreview}
                onMove={onMoveComponent}
                onSelect={() => onSelectComponent(index)}
                onRemove={() => onRemoveComponent(index)}
              />
            ))}
          </s-stack>
        )}
      </div>
    </div>
  );
}

// ==================== DRAGGABLE COMPONENT ====================
function DraggableComponent({ 
  component, 
  index, 
  isSelected, 
  showPreview,
  onMove, 
  onSelect, 
  onRemove 
}) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.COMPONENT,
    item: { itemType: ItemTypes.COMPONENT, index },
    canDrag: !showPreview,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.COMPONENT,
    hover: (item) => {
      if (item.index !== index) {
        onMove(item.index, index);
        item.index = index; // Update the item's index for next hover
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={(node) => !showPreview && drag(drop(node))}
      onClick={onSelect}
      style={{
        ...styles.componentWrapper,
        ...(isSelected && !showPreview ? styles.componentWrapperSelected : {}),
        opacity: isDragging ? 0.5 : 1,
        cursor: showPreview ? "default" : "move",
        borderTop: isOver && !showPreview ? "3px solid #3b82f6" : undefined,
      }}
    >
      {isSelected && !showPreview && (
        <s-button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          variant="secondary"
          size="slim"
          style={styles.deleteButton}
        >
          ✕ Remove
        </s-button>
      )}
      <RenderComponent component={component} preview={showPreview} />
    </div>
  );
}

// ==================== ELEMENTS PANEL ====================
function ElementsPanel({ onAddComponent }) {
  return (
    <s-stack direction="vertical" gap="tight">
      {ELEMENTS.map((element) => (
        <DraggableElement 
          key={element.type} 
          element={element} 
          onAddComponent={onAddComponent}
        />
      ))}
    </s-stack>
  );
}

// ==================== DRAGGABLE ELEMENT ====================
function DraggableElement({ element, onAddComponent }) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.ELEMENT,
    item: { itemType: ItemTypes.ELEMENT, elementType: element.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      onClick={() => onAddComponent(element.type)}
      style={{
        ...styles.elementCard,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? "grabbing" : "grab",
      }}
    >
      <div style={{ fontSize: "24px" }}>{element.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: "500", fontSize: "14px", marginBottom: "2px" }}>
          {element.label}
        </div>
        <div style={{ fontSize: "12px", color: "#666" }}>
          {element.description}
        </div>
      </div>
    </div>
  );
}

// ==================== PROPERTIES PANEL ====================
function PropertiesPanel({ component, onUpdateLabel, onUpdatePlaceholder, onUpdateRequired, onUpdateStyle }) {
  const { type, label, placeholder, required, styles } = component;

  return (
    <s-stack direction="vertical" gap="loose">
      <div>
        <label style={stylesObj.propertyLabel}>Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => onUpdateLabel(e.target.value)}
          style={stylesObj.input}
        />
      </div>

      {(type === "text") && (
        <div>
          <label style={stylesObj.propertyLabel}>Placeholder</label>
          <input
            type="text"
            value={placeholder}
            onChange={(e) => onUpdatePlaceholder(e.target.value)}
            style={stylesObj.input}
          />
        </div>
      )}

      <div>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => onUpdateRequired(e.target.checked)}
          />
          <span style={stylesObj.propertyLabel}>Required field</span>
        </label>
      </div>

      {type === "heading" && (
        <>
          <div>
            <label style={stylesObj.propertyLabel}>Heading Level</label>
            <select 
              value={styles.headingLevel} 
              onChange={(e) => onUpdateStyle("headingLevel", e.target.value)} 
              style={stylesObj.input}
            >
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
              <option value="h5">H5</option>
              <option value="h6">H6</option>
            </select>
          </div>

          <div>
            <label style={stylesObj.propertyLabel}>Font Size</label>
            <input 
              type="text" 
              value={styles.fontSize} 
              onChange={(e) => onUpdateStyle("fontSize", e.target.value)} 
              placeholder="24px" 
              style={stylesObj.input} 
            />
          </div>

          <div>
            <label style={stylesObj.propertyLabel}>Color</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                type="color" 
                value={styles.color} 
                onChange={(e) => onUpdateStyle("color", e.target.value)} 
                style={{ width: "50px", height: "38px", border: "1px solid #d1d5db", borderRadius: "6px" }} 
              />
              <input 
                type="text" 
                value={styles.color} 
                onChange={(e) => onUpdateStyle("color", e.target.value)} 
                style={{ flex: 1, ...stylesObj.input }} 
              />
            </div>
          </div>
        </>
      )}

      {type === "number" && (
        <>
          <div>
            <label style={stylesObj.propertyLabel}>Minimum Value</label>
            <input 
              type="number" 
              value={styles.min} 
              onChange={(e) => onUpdateStyle("min", e.target.value)} 
              style={stylesObj.input} 
            />
          </div>

          <div>
            <label style={stylesObj.propertyLabel}>Maximum Value</label>
            <input 
              type="number" 
              value={styles.max} 
              onChange={(e) => onUpdateStyle("max", e.target.value)} 
              style={stylesObj.input} 
            />
          </div>
        </>
      )}
    </s-stack>
  );
}

// ==================== RENDER COMPONENT ====================
function RenderComponent({ component, preview }) {
  const { type, label, placeholder, required, styles } = component;

  switch (type) {
    case "heading":
      const HeadingTag = styles.headingLevel || "h2";
      return (
        <HeadingTag style={{ 
          fontSize: styles.fontSize, 
          color: styles.color, 
          fontWeight: styles.fontWeight, 
          textAlign: styles.textAlign, 
          margin: 0 
        }}>
          {label}
        </HeadingTag>
      );

    case "paragraph":
      return (
        <p style={{ 
          fontSize: styles.fontSize, 
          color: styles.color, 
          lineHeight: styles.lineHeight, 
          textAlign: styles.textAlign, 
          margin: 0 
        }}>
          {label}
        </p>
      );

    case "text":
      return (
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "500" }}>
            {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
          </label>
          <input
            type="text"
            placeholder={placeholder}
            disabled={!preview}
            style={{
              width: "100%",
              maxWidth: "100%",
              height: styles.height,
              background: styles.bgColor,
              border: `${styles.borderWidth} solid ${styles.borderColor}`,
              borderRadius: styles.borderRadius,
              padding: "8px 12px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>
      );

    case "number":
      return (
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "500" }}>
            {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
          </label>
          <input
            type="number"
            min={styles.min}
            max={styles.max}
            disabled={!preview}
            style={{
              width: "100%",
              maxWidth: "100%",
              height: styles.height,
              background: styles.bgColor,
              border: `${styles.borderWidth} solid ${styles.borderColor}`,
              borderRadius: styles.borderRadius,
              padding: "8px 12px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>
      );

    default:
      return <s-text>Unknown component type</s-text>;
  }
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
  },
  topBar: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "12px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  formNameInput: {
    fontSize: "16px",
    fontWeight: "600",
    border: "1px solid #d1d5db",
    outline: "none",
    padding: "8px 12px",
    borderRadius: "6px",
    minWidth: "300px",
  },
  editorContainer: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    gap: "0",
  },
  canvasArea: {
    flex: "0 0 65%",
    overflowY: "auto",
    padding: "40px 20px",
    transition: "background 0.2s",
  },
  canvasContent: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  dropZonePlaceholder: {
    padding: "100px 20px",
    textAlign: "center",
    background: "#fff",
    border: "2px dashed #d1d5db",
    borderRadius: "12px",
  },
  componentWrapper: {
    position: "relative",
    padding: "20px",
    background: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    transition: "all 0.2s",
  },
  componentWrapperSelected: {
    background: "#eff6ff",
    border: "2px solid #3b82f6",
    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
  },
  deleteButton: {
    position: "absolute",
    top: "8px",
    right: "8px",
    zIndex: 10,
  },
  sidebar: {
    flex: "0 0 35%",
    background: "#fff",
    borderLeft: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    maxWidth: "35%",
  },
  sidebarTabs: {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
  },
  tabButton: {
    flex: 1,
    padding: "14px 16px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    color: "#6b7280",
    transition: "all 0.2s",
  },
  tabButtonActive: {
    color: "#3b82f6",
    borderBottom: "2px solid #3b82f6",
    background: "#f9fafb",
  },
  tabButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  sidebarContent: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
  },
  elementCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "#f9fafb",
    border: "2px dashed #d1d5db",
    borderRadius: "8px",
    transition: "all 0.2s",
    userSelect: "none",
  },
};

const stylesObj = {
  propertyLabel: {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#374151",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
};