import React, { useState, useEffect, useRef } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response";
import * as XLSX from "xlsx";
import { e } from "mathjs";

//formula input component
//autocomplete input for {label} formula syntax
const FormulaInput = ({
  value = "",
  onChange,
  components = [],
  placeholder = "e.g., {Size} + {Color} * 2",
  style = {},
  showConversion = true,
  multiline = false
}) => {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  
  // Get filtered list of available fields
  const getAvailableFields = () => {
    const fields = components
      .filter(c => c.label && c.label.trim())
      .map((c, index) => ({
        label: c.label,
        type: c.type,
        index: index + 1,
        id: c.id
      }));
    
    if (!searchTerm) return fields;
    
    const term = searchTerm.toLowerCase();
    return fields.filter(f => 
      f.label.toLowerCase().includes(term) ||
      f.type.toLowerCase().includes(term)
    );
  };
  
  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
    const lastCloseBrace = textBeforeCursor.lastIndexOf('}');
    
    if (lastOpenBrace > lastCloseBrace) {
      const search = textBeforeCursor.substring(lastOpenBrace + 1);
      setSearchTerm(search);
      setShowAutocomplete(true);
      setSelectedIndex(0);
      
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        const lineHeight = 20;
        const lines = textBeforeCursor.split('\n').length;
        
        setAutocompletePosition({
          top: rect.top + (lines * lineHeight) + (multiline ? 20 : 30),
          left: rect.left + 10
        });
      }
    } else {
      setShowAutocomplete(false);
    }
  };
  
  // Insert field into formula
  const insertField = (field, addQty = false) => {
    const input = inputRef.current;
    if (!input) return;
    
    const cursorPos = input.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
    
    const fieldText = addQty ? `{${field.label}_qty}` : `{${field.label}}`;
    
    const newValue = 
      textBeforeCursor.substring(0, lastOpenBrace) +
      fieldText +
      textAfterCursor;
    
    onChange(newValue);
    setShowAutocomplete(false);
    
    setTimeout(() => {
      const newCursorPos = lastOpenBrace + fieldText.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
      input.focus();
    }, 0);
  };
  
  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showAutocomplete) return;
    
    const fields = getAvailableFields();
    
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, fields.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        if (fields.length > 0 && selectedIndex < fields.length) {
          e.preventDefault();
          insertField(fields[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowAutocomplete(false);
        break;
    }
  };
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Auto-scroll selected item
  useEffect(() => {
    if (showAutocomplete && autocompleteRef.current) {
      const selectedElement = autocompleteRef.current.children[selectedIndex + 1]; // +1 for header
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, showAutocomplete]);
  
  // Type icons
  const getTypeIcon = (type) => {
    const icons = {
      'number_input': '🔢',
      'dropdown': '▾',
      'radio': '◉',
      'checkbox': '☑',
      'text_input': '✏️',
      'calculation_display': '🧮',
      'data_lookup': '🔍',
      'image_selector': '🖼️'
    };
    return icons[type] || '📋';
  };
  
  const fields = getAvailableFields();
  const baseInputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    fontFamily: 'Monaco, Consolas, monospace',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    outline: 'none',
    ...style
  };
  
  const inputStyle = multiline 
    ? { ...baseInputStyle, minHeight: '80px', resize: 'vertical' }
    : baseInputStyle;
  
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {multiline ? (
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={inputStyle}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
      
      {showAutocomplete && fields.length > 0 && (
        <div
          ref={autocompleteRef}
          style={{
            position: 'fixed',
            top: autocompletePosition.top,
            left: autocompletePosition.left,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
            minWidth: '280px',
            padding: '4px'
          }}
        >
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid #e5e7eb',
            fontSize: '11px',
            fontWeight: '600',
            color: '#6b7280'
          }}>
            Insert Field {searchTerm && `(${fields.length} matches)`}
          </div>
          
          {fields.map((field, index) => (
            <div
              key={field.id}
              onClick={() => insertField(field)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                background: selectedIndex === index ? '#eff6ff' : 'transparent',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{getTypeIcon(field.type)}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', fontFamily: 'Monaco, monospace' }}>
                    {`{${field.label}}`}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {field.type.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
              
              {field.type === 'number_input' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    insertField(field, true);
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  + _qty
                </button>
              )}
            </div>
          ))}
          
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '10px',
            color: '#9ca3af'
          }}>
            ↑↓ navigate • Enter/Tab select • Esc close
          </div>
        </div>
      )}
      
      <div style={{
        marginTop: '8px',
        padding: '10px',
        background: '#f0f9ff',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#0369a1'
      }}>
        <strong>💡 Tip:</strong> Type <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>{'{'}</code> to insert field names. Use <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>_qty</code> suffix for raw quantities.
      </div>
    </div>
  );
};



// ----------loader-----------------------------------------
// loader fetches the form for editing
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

// ---------------element-----------------------
const ELEMENTS = [
  {
    type: "heading",
    icon: "📝",
    label: "Heading",
    description: "Main heading",
    isFixed: true, //always appear at top
    defaultStyles: {
      //typography
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "32px",
      fontWeight: "700",
      lineHeight: "1.2",
      letterSpacing: "0px",

      //layout
      textAlign: "left",
      width: "100%",
      padding: "20px 0",

      //colors
      textColor: "#1f2937",
      bgColor: "transparent",

      //spacing
      marginBottom: "24px",
    },
    defaultContent:{
      text: "Form Heading"
    },
    defaultTooltip: {enabled: false, text: ""},
    additionalInfo: "Main heading that appears at the top of your form"
  },

  {
    type: "dropdown",
    icon: "▾",
    label: "Dropdown",
    description: "Select one value from a list of options",
  
    defaultStyles: {
      //typography
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "400",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textColor: "#374151",

      // Field styling
      width: "100%",
      height: "40px",
      padding: "8px 12px",
      bgColor: "#ffffff",
      borderColor: "#e5e7eb",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultOptions: [
      { id: 1, name: "Option 1", value: "0" },
      { id: 2, name: "Option 2", value: "0" },
    ],
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo:
      "display a list of options in a dropdown. you can assign a value to each option used in formulas.",
  },

  {
    type: "image_selector",
    icon: "🖼️",
    label: "Image Selector",
    description: "select an image from a list/swatch",
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "500",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textColor: "#374151",
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultOptions: [
      { id: 1, name: "Option 1", value: "0", image: null },
      { id: 2, name: "Option 2", value: "0", image: null },
    ],
    defaultSettings: {
      enableSwatch: true,
      showImageOnSelection: false,
    },
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo:
      "allows customers to select images from a swatch and optionally display the selected image.",
  },

  {
    type: "data_lookup",
    icon: "📊",
    label: "Data Lookup",
    description: "lookup values from table",
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "400",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textColor: "#374151",
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultSettings: {
      //for input 1
      input1Name: "Input 1",
      input1Formula: false,
      input1FormulaText: "",
      input1MaxDecimal: 0,
      input1MinValue: "0",
      input1MaxValue: "10000",

      //for input 2
      input2Name: "Input 2",
      input2Formula: false,
      input2FormulaText: "",
      input2MaxDecimal: 0,
      input2MinValue: "0",
      input2MaxValue: "10000",
    },
    defaultTableData: {
      columnHeaders: ['100', '1000', '2500', '5000'], //4 default coumns
      rows: [
        {id: 1, header: '10', values: ['','','','']},
        {id: 2, header: '20', values: ['','','','']},
        {id: 3, header: '30', values: ['','','','']}
      ]
    },
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "",
  },

  {
    type: "text_block",
    icon: "📋",
    label: "Text Block",
    description: "text content (heading + rich text)",
    
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "400",
      lineHeight: "1.6",
      letterSpacing: "0px",
      textAlign: "left",
      width: "100%",
      padding: "20px 0",
      textColor: "#374151",
      bgColor: "transparent",
      marginBottom: "24px",
    },
    defaultContent: { heading: "", richText: "" },
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "display formatted text or instructions.",
  },

  {
    type: "text_input",
    icon: "✎",
    label: "Text Input",
    description: "single line text",
    
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "400",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textAlign: "left",
      textColor: "#374151",
      width: "100%",
      height: "40px",
      padding: "8px 12px",
      bgColor: "#ffffff",
      borderColor: "#e5e7eb",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultSettings: {
      includeSpaceInLength: false,
      minCharacters: "0",
      maxCharacters: "50",
      placeholder: "",
      required: false,
    },
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "allows customers to enter single-line text.",
  },

  {
    type: "checkbox",
    icon: "☑",
    label: "Checkbox",
    description: "toggle option",
    
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "500",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textAlign: "left",
      textColor: "#374151",
      width: "100%",
      padding: "12px",
      bgColor: "#ffffff",
      borderColor: "#e5e7eb",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultSettings: {
      multipleSelection: false,
      unCheckedValue: "0",
      checkedValue: "10",
      required: false,
    },
    defaultOptions: [
      { id: 1, name: "option 1", value: "0"},
      { id: 2, name: "Option 2", value: "0"},
    ],
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "allows customers to check a box.",
  },

  {
    type: "number_input",
    icon: "🔢",
    label: "Number Input",
    description: "numeric input with ranges",
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "400",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textColor: "#374151",
      width: "100%",
      height: "40px",
      padding: "8px 12px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultSettings: {
      useAsQuantity: false,
      minValue: "0",
      maxValue: "10000",
      maxDecimal: 0,
      valueRangeEnabled: false,
    },
    //value ranges for number input
    defaultValueRanges: [{ id: 1, start: "0", end: "0", value: "0" }],
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "accept numeric input, can be used as quantity.",
  },

  {
    type: "calculation_display",
    icon: "🧮",
    label: "Calculation Display",
    description: "show calculated values",
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "16px",
      fontWeight: "600",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textColor: "#374151",
      width: "100%",
      height: "40px",
      padding: "8px 12px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultSettings: {
      useAsQuantity: false,
      formula: "",
      minValue: "0",
      formulaDecimal: 0,
      formulaPrefix: "",
      formulaSuffix: "",
    },
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "display results of a formula.",
  },

  {
    type: "file_upload",
    icon: "📤",
    label: "File Upload",
    description: "upload files",
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "500",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textColor: "#374151",
      width: "100%",
      height: "80px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultSettings: { required: false },
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "allow customers to upload files (png/jpg/pdf).",
  },

  {
    type: "photo_editor",
    icon: "✂️",
    label: "Photo Editor",
    description: "upload and edit photos",
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "500",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textColor: "#374151",
      width: "100%",
      height: "40px",
      bgColor: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultSettings: { required: false },
    defaultButtonStyle: { buttonText: "Edit", bgColor: "#000000", textColor: "#ffffff" },
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "upload an image and optionally edit it.",
  },

  {
    type: "radio",
    icon: "◉",
    label: "Radio",
    description: "Select one option from radio buttons",
    
    defaultStyles: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "400",
      lineHeight: "1.5",
      letterSpacing: "0px",
      textAlign: "left",
      textColor: "#374151",
      width: "100%",
      padding: "8px",
      bgColor: "#f9fafb",
      borderColor: "#e5e7eb",
      borderWidth: "1px",
      borderRadius: "6px",
      marginBottom: "16px",
    },
    defaultOptions: [
      { id: 1, name: "Option 1", value: "0" },
      { id: 2, name: "Option 2", value: "0" },
    ],
    defaultConditionalDisplay: {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    defaultTooltip: { enabled: false, text: "" },
    additionalInfo: "",
  },
];

//-----------fonts----------------
const POPULAR_FONTS = [
  { name: "Inter", value: "Inter, system-ui, sans-serif", category: "Modern" },
  { name: "Roboto", value: "Roboto, sans-serif", category: "Modern" },
  { name: "Open Sans", value: "'Open Sans', sans-serif", category: "Modern" },
  { name: "Lato", value: "Lato, sans-serif", category: "Modern" },
  { name: "Montserrat", value: "Montserrat, sans-serif", category: "Modern" },
  { name: "Poppins", value: "Poppins, sans-serif", category: "Modern" },
  { name: "Playfair Display", value: "'Playfair Display', serif", category: "Elegant" },
  { name: "Merriweather", value: "Merriweather, serif", category: "Elegant" },
  { name: "Georgia", value: "Georgia, serif", category: "Classic" },
  { name: "Times New Roman", value: "'Times New Roman', serif", category: "Classic" },
  { name: "Arial", value: "Arial, sans-serif", category: "Classic" },
  { name: "Helvetica", value: "Helvetica, sans-serif", category: "Classic" },
  { name: "Courier New", value: "'Courier New', monospace", category: "Monospace" },
  { name: "Monaco", value: "Monaco, monospace", category: "Monospace" },

];

// safe json parse util
function safeJSONParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

// ==================== form builder editor ====================
export default function FormBuilderEditor() {
  const { form } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  // local state
  const [formName, setFormName] = useState(form?.name || "");
  const [components, setComponents] = useState(() => {
    const fields = form?.fields || [];
    
    const mapped = fields.map((f) => {
      const parsedOptions = f.options ? safeJSONParse(f.options, {}) : {};
      const parsedMetadata = f.metadata ? safeJSONParse(f.metadata, {}) : {};
      
      const baseComponent = {
        id: f.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder || "",
        required: !!f.required,
        styles: parsedOptions,
        tooltip: parsedMetadata.tooltip || { enabled: false, text: "" },
        conditionalDisplay: parsedMetadata.conditionalDisplay || {
          enabled: false,
          valueWhenNotDisplayed: "1",
          triggerElementId: null,
        },
        additionalInfo: parsedMetadata.additionalInfo || "",
      };

     // add element-specific properties
      switch (f.type) {

        case "heading":
          return {
            ...baseComponent,
            content: parsedMetadata.content || { text : "Form"},
          };

           
        case "dropdown":
        case "radio":
          return {
            ...baseComponent,
            options:
              parsedMetadata.options || [
                { id: 1, name: "Option 1", value: "0" },
                { id: 2, name: "Option 2", value: "0" },
              ],
          };

        case "image_selector":
          return {
            ...baseComponent,
            options:
              parsedMetadata.options || [
                { id: 1, name: "Option 1", value: "0", image: null },
                { id: 2, name: "Option 2", value: "0", image: null },
              ],
            settings:
              parsedMetadata.settings || {
                enableSwatch: true,
                showImageOnSelection: false,
              },
          };

        case "data_lookup":
          return {
            ...baseComponent,
            settings:
              parsedMetadata.settings || {
                input1Name: "Input 1",
                input1Formula: false,
                input1FormulaText: "",
                input1MaxDecimal: 0,
                input1MinValue: "0",
                input1MaxValue: "10000",
                input2Name: "Input 2",
                input2Formula: false,
                input2FormulaText: "",
                input2MaxDecimal: 0,
                input2MinValue: "0",
                input2MaxValue: "10000",
              },
            tableData: parsedMetadata.tableData || null,
          };

        case "number_input":
          return {
            ...baseComponent,
            settings:
              parsedMetadata.settings || {
                useAsQuantity: false,
                minValue: "0",
                maxValue: "10000",
                maxDecimal: 0,
                valueRangeEnabled: false,
              },
            valueRanges:
              parsedMetadata.valueRanges || [
                { id: 1, start: "0", end: "0", value: "0" }
              ],
          };

        case "text_block":
          return {
            ...baseComponent,
            content: parsedMetadata.content || { heading: "", richText: "" },
          };

        case "file_upload":
          return {
            ...baseComponent,
            settings: parsedMetadata.settings || { required: false },
          };

        case "photo_editor":
          return {
            ...baseComponent,
            settings: parsedMetadata.settings || { required: false },
            buttonStyle:
              parsedMetadata.buttonStyle || {
                buttonText: "Edit",
                bgColor: "#000000",
                textColor: "#ffffff",
              },
          };

        case "text_input":
          return {
            ...baseComponent,
            settings:
              parsedMetadata.settings || {
                includeSpaceInLength: false,
                minCharacters: "0",
                maxCharacters: "50",
                placeholder: "",
                required: false,
              },
          };

        case "checkbox":
          return {
            ...baseComponent,
            settings:
              parsedMetadata.settings || {
                multipleSelection: false,
                unCheckedValue: "0",
                checkedValue: "10",
                required: false,
              },
              options: parsedMetadata.options || [
                { id: 1, name: "Option 1", value: "0" },
                { id: 2, name: "Option 2", value: "0" },
              ],
          };

        case "calculation_display":
          return {
            ...baseComponent,
            settings:
              parsedMetadata.settings || {
                useAsQuantity: false,
                formula: "",
                minValue: "0",
                formulaDecimal: 0,
                formulaPrefix: "",
                formulaSuffix: "",
              },
          };

        default:
          return baseComponent;
      }
    });

    //sort to ensure heading is always first
    return  mapped.sort((a,b) => {
      if (a.type === "heading") return -1;
      if (b.type === "heading") return 1;
      return 0;
    });
    
    
  });

  const [selectedComponentIndex, setSelectedComponentIndex] = useState(null);
  const [activeTab, setActiveTab] = useState("elements");
  const [saved, setSaved] = useState(false);
  const [canvasSectionTab, setCanvasSectionTab] = useState("formula");

  // Initialize canvas settings from database
  const [formulaSettings, setFormulaSettings] = useState(() => {
    if (form?.formulaSettings) {
      const parsed = safeJSONParse(form.formulaSettings, null);
      console.log("🔍 LOAD DEBUG - Formula settings:", parsed);
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

  const [productSettings, setProductSettings] = useState(() => {
    if (form?.productSettings) {
      return safeJSONParse(form.productSettings, {
        showOnAllProducts: false,
        selectedProducts: [],
      });
    }
    return { showOnAllProducts: false, selectedProducts: [] };
  });

  const [nonProductSettings, setNonProductSettings] = useState(() => {
    if (form?.nonProductSettings) {
      return safeJSONParse(form.nonProductSettings, { pages: [] });
    }
    return { pages: [] };
  });

  //advanced settings
  const [advancedSettings, setAdvancedSettings] = useState(() => {
    if (form?.advancedSettings) {
      return safeJSONParse(form.advancedSettings, {
        archiveCalculator: false,
        availableAtAllLocations: false,
        skuSameAsProduct: false,
        variantWeightCalculation: false,
        variantCostCalculation: false,
      });
    }
    return {
      archiveCalculator: false,
      availableAtAllLocations: false,
      skuSameAsProduct: false,
      variantWeightCalculation: false,
      variantCostCalculation: false,
    };
  });

  //cart settings
  const [cartSettings, setCartSettings] = useState(() => {
  if (form?.cartSettings) {
    return safeJSONParse(form.cartSettings, {
      mode: "existing_product",
      baseProductId: "",
      productVariantId: "",
      redirectAfterAdd: true,
      showSuccessMessage: true,
      successMessage: "Added to cart!",
      variantMapping: [],
      generateSKU: true,
      skuPrefix: "CUSTOM-",
      requiresApproval: false,
      sendEmail: true,
      emailSubject: "Your Custom Form is Ready",
      orderNoteTemplate: "Custom form submission\n\nConfiguration:\n{{form_data}}\n\nTotal: {{calculated_price}}"
    });
  }
  return {
    mode: "existing_product",
    baseProductId: "",
    productVariantId: "",
    redirectAfterAdd: true,
    showSuccessMessage: true,
    successMessage: "Added to cart!",
    variantMapping: [],
    generateSKU: true,
    skuPrefix: "CUSTOM-",
    requiresApproval: false,
    sendEmail: true,
    emailSubject: "Your Custom Form is Ready",
    orderNoteTemplate: "Custom form submission\n\nConfiguration:\n{{form_data}}\n\nTotal: {{calculated_price}}"
  };
})



  // helper - display saved state temporarily
  useEffect(() => {
    if (fetcher.data?.success) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [fetcher.data]);

  // component operations (add/remove/update) -----
  const addComponent = (componentType) => {
    const elementDef = ELEMENTS.find((e) => e.type === componentType);
    if (!elementDef) return;

    //check if it's a  heading element and if one already exists
    if (componentType === "heading"){
      const headingExists = components.some(c => c.type === "heading");
      if (headingExists){
        alert("Only one heading is allowed per form");
        return;
      }
    }


    const id = `temp-${Date.now()}`;
    const newComp = {
      id,
      type: elementDef.type,
      label: elementDef.label,
      placeholder: "",
      required: false,
      styles: elementDef.defaultStyles || {},
      ...(elementDef.defaultOptions ? { options: elementDef.defaultOptions } : {}),
      ...(elementDef.defaultSettings ? { settings: elementDef.defaultSettings } : {}),
      ...(elementDef.defaultContent ? { content: elementDef.defaultContent } : {}),
      ...(elementDef.defaultTooltip ? { tooltip: elementDef.defaultTooltip } : {}),
      ...(elementDef.defaultButtonStyle ? { buttonStyle: elementDef.defaultButtonStyle } : {}),
      ...(elementDef.defaultTableData !== undefined ? { tableData: elementDef.defaultTableData } : {}),
      ...(elementDef.defaultValueRanges ? { valueRanges: elementDef.defaultValueRanges } : {}),
      additionalInfo: elementDef.additionalInfo || "",
      conditionalDisplay: elementDef.defaultConditionalDisplay || {
        enabled: false,
        valueWhenNotDisplayed: "1",
        triggerElementId: null
      },
    };

    //if it's a heading always insert at the beginning
    setComponents((prev) => {
      let next;
      if (componentType === "heading"){
        next = [newComp,...prev];
        setSelectedComponentIndex(0);
      } else {
        next = [...prev, newComp];
        setSelectedComponentIndex(next.length - 1);
      }
      return next;
    });

    setActiveTab("properties");
  };



  const removeComponent = (index) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
    setSelectedComponentIndex(null);
  };

  const duplicateComponent = (index) => {
    const componentToDuplicate = components[index];
    if (!componentToDuplicate) return;
    const duplicatedComponent = {
      ...componentToDuplicate,
      id: `temp-${Date.now()}`,
      label: `${componentToDuplicate.label} (Copy)`,
    };
    setComponents((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, duplicatedComponent);
      return copy;
    });
    setSelectedComponentIndex(index + 1);
    setActiveTab("properties");
  };

  const updateComponent = (index, field, value) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateComponentStyle = (index, styleKey, value) => {
    setComponents((prev) => {
      const copy = [...prev];
      const current = copy[index] || {};
      copy[index] = { ...current, styles: { ...(current.styles || {}), [styleKey]: value } };
      return copy;
    });
  };

  const updateComponentOptions = (index, options) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], options };
      return copy;
    });
  };

  const updateComponentTooltip = (index, tooltipData) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], tooltip: tooltipData };
      return copy;
    });
  };

  const updateComponentSettings = (index, settings) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], settings };
      return copy;
    });
  };

  const updateComponentValueRanges = (index, valueRanges) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], valueRanges };
      return copy;
    });
  };

  const updateComponentContent = (index, content) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], content };
      return copy;
    });
  };

  const updateComponentButtonStyle = (index, buttonStyle) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], buttonStyle };
      return copy;
    });
  };

  const updateComponentTableData = (index, tableData) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], tableData };
      return copy;
    });
  };

  const updateComponentConditionalDisplay = (index, conditionalDisplay) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], conditionalDisplay };
      return copy;
    });
  };

//state to track drag operations
const [draggedIndex, setDraggedIndex] = useState(null);
const [dragOverIndex, setDragOverIndex] = useState(null);


// Sidebar element drag start (new elements)
const handleDragStart = (e, type) => {
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData("application/json", JSON.stringify({ source: "sidebar", type }));
  console.log("Drag started (sidebar):", type);
};

// Canvas component drag start (reordering)
const handleComponentDragStart = (e, index) => {
  e.stopPropagation();
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("application/json", JSON.stringify({ source: "canvas", index }));
  setDraggedIndex(index);
  console.log("Component drag started (canvas):", index);
};

// Main canvas drop handler (for new elements from sidebar or dropping to empty area)
const handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();

  try {
    const data = JSON.parse(e.dataTransfer.getData("application/json"));
    console.log("Drop received (canvas):", data);

    // New component from sidebar -> insert at end (or beginning for heading)
    if (data.source === "sidebar") {
      const elementDef = ELEMENTS.find((el) => el.type === data.type);
      if (!elementDef) return;

      if (data.type === "heading") {
        const headingExists = components.some((c) => c.type === "heading");
        if (headingExists) {
          alert("Only one heading is allowed per form");
          return;
        }
      }

      const id = `temp-${Date.now()}`;
      const newComp = {
        id,
        type: elementDef.type,
        label: elementDef.label,
        placeholder: "",
        required: false,
        styles: elementDef.defaultStyles || {},
        ...(elementDef.defaultOptions ? { options: elementDef.defaultOptions } : {}),
        ...(elementDef.defaultSettings ? { settings: elementDef.defaultSettings } : {}),
        ...(elementDef.defaultContent ? { content: elementDef.defaultContent } : {}),
        ...(elementDef.defaultTooltip ? { tooltip: elementDef.defaultTooltip } : {}),
        ...(elementDef.defaultButtonStyle ? { buttonStyle: elementDef.defaultButtonStyle } : {}),
        ...(elementDef.defaultTableData !== undefined ? { tableData: elementDef.defaultTableData } : {}),
        ...(elementDef.defaultValueRanges ? { valueRanges: elementDef.defaultValueRanges } : {}),
        additionalInfo: elementDef.additionalInfo || "",
        conditionalDisplay: elementDef.defaultConditionalDisplay || {
          enabled: false,
          valueWhenNotDisplayed: "1",
          triggerElementId: null,
        },
      };

      setComponents((prev) => {
        const next = [...prev];
        if (data.type === "heading") {
          next.unshift(newComp);
          setSelectedComponentIndex(0);
        } else {
          next.push(newComp);
          setSelectedComponentIndex(next.length - 1);
        }
        return next;
      });

      setActiveTab("properties");
      setDragOverIndex(null);
      return;
    }

    // Dropping an existing canvas item onto the empty area -> move it to the end
    if (data.source === "canvas") {
      const fromIndex = data.index;
      if (fromIndex === undefined) return;

      setComponents((prev) => {
        const copy = [...prev];
        const [moved] = copy.splice(fromIndex, 1);
        copy.push(moved);
        return copy;
      });

      setSelectedComponentIndex(components.length - 1);
    }
  } catch (error) {
    console.error("Drop error:", error);
  }

  setDragOverIndex(null);
};

const handleDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "copy";
};

// Component drop handler (for reordering)
const handleComponentDrop = (e, dropIndex) => {
  e.preventDefault();
  e.stopPropagation();

  try {
    const data = JSON.parse(e.dataTransfer.getData("application/json"));
    console.log("Component drop:", data, "at index:", dropIndex);

    // determine whether user dropped above or below the hovered element
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const insertAfter = offsetY > rect.height / 2;
    const targetIndex = insertAfter ? dropIndex + 1 : dropIndex;

    if (data.source === "sidebar") {
      // New element from sidebar - insert at specific position
      const elementDef = ELEMENTS.find((el) => el.type === data.type);
      if (!elementDef) return;

      // Check if it's a heading element and if one already exists
      if (data.type === "heading") {
        const headingExists = components.some(c => c.type === "heading");
        if (headingExists) {
          alert("Only one heading is allowed per form");
          return;
        }
      }

      const id = `temp-${Date.now()}`;
      const newComp = {
        id,
        type: elementDef.type,
        label: elementDef.label,
        placeholder: "",
        required: false,
        styles: elementDef.defaultStyles || {},
        ...(elementDef.defaultOptions ? { options: elementDef.defaultOptions } : {}),
        ...(elementDef.defaultSettings ? { settings: elementDef.defaultSettings } : {}),
        ...(elementDef.defaultContent ? { content: elementDef.defaultContent } : {}),
        ...(elementDef.defaultTooltip ? { tooltip: elementDef.defaultTooltip } : {}),
        ...(elementDef.defaultButtonStyle ? { buttonStyle: elementDef.defaultButtonStyle } : {}),
        ...(elementDef.defaultTableData !== undefined ? { tableData: elementDef.defaultTableData } : {}),
        ...(elementDef.defaultValueRanges ? { valueRanges: elementDef.defaultValueRanges } : {}),
        additionalInfo: elementDef.additionalInfo || "",
        conditionalDisplay: elementDef.defaultConditionalDisplay || {
          enabled: false,
          valueWhenNotDisplayed: "1",
          triggerElementId: null
        },
      };

      setComponents((prev) => {
        const next = [...prev];
        // If heading, always insert at beginning
        if (data.type === "heading") {
          next.unshift(newComp);
          setSelectedComponentIndex(0);
        } else {
          // Insert at computed target position (before/after hovered item)
          next.splice(targetIndex, 0, newComp);
          setSelectedComponentIndex(targetIndex);
        }
        return next;
      });

      setActiveTab("properties");
    } else if (data.source === "canvas") {
      // Reordering existing component
      const fromIndex = data.index;

      if (fromIndex === undefined) return;

      // If dropping to same visual spot do nothing
      if (fromIndex === targetIndex || fromIndex === targetIndex - 1) {
        return;
      }

      console.log(`Reordering: index ${fromIndex} -> ${targetIndex}`);

      setComponents((prev) => {
        const copy = [...prev];
        const [moved] = copy.splice(fromIndex, 1);

        // Adjust insertion index because removal may shift positions
        const adjustedDropIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
        copy.splice(adjustedDropIndex, 0, moved);

        return copy;
      });

      // compute final selected index after move
      const finalIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
      setSelectedComponentIndex(finalIndex);
    }
  } catch (error) {
    console.error("Component drop error:", error);
  }

  setDraggedIndex(null);
  setDragOverIndex(null);
};

const handleComponentDragOver = (e, index) => {
  e.preventDefault();
  e.stopPropagation();
  
  try {
    const data = JSON.parse(e.dataTransfer.getData("application/json"));
    
    if (data.source === "canvas") {
      e.dataTransfer.dropEffect = "move";
    } else {
      e.dataTransfer.dropEffect = "copy";
    }
    
    setDragOverIndex(index);
  } catch (error) {
    e.dataTransfer.dropEffect = "copy";
  }
};

const handleComponentDragEnd = () => {
  setDraggedIndex(null);
  setDragOverIndex(null);
};

  // ----- save -----
  const handleSave = () => {
    const fieldsToSave = components.map((comp, index) => {
      const styles = comp.styles || {};
      const metadata = {};

      //always save these common fields to metadata
      if (comp.tooltip) metadata.tooltip = comp.tooltip;;
      if (comp.conditionalDisplay) metadata.conditionalDisplay = comp.conditionalDisplay;
      if (comp.additionalInfo) metadata.additionalInfo = comp.additionalInfo;

      //element-specific metadata
      if (comp.content) metadata.content = comp.content;
      if (comp.options) metadata.options = comp.options;
      if (comp.settings) metadata.settings = comp.settings;
      if (comp.valueRanges) metadata.valueRanges = comp.valueRanges;
      if (comp.content) metadata.content = comp.content;
      if (comp.buttonStyle) metadata.buttonStyle = comp.buttonStyle;
      if (comp.tableData) metadata.tableData = comp.tableData;

      console.log(`DEBUG - ${comp.type} metadata:`, metadata);

      return {
      id: comp.id && String(comp.id).startsWith("temp-") ? undefined : comp.id,
      type: comp.type,
      label: comp.label,
      placeholder: comp.placeholder || "",
      required: !!comp.required,
      order: index,
      options: JSON.stringify(styles),
      metadata: JSON.stringify(metadata),
      };
    });

    console.log("CLIENT DEBUG - All fields to save:", fieldsToSave);
    console.log("CLIENT DEBUG - Formula settings:", formulaSettings);

    const formData = new FormData();
    formData.append("actionType", "update");
    formData.append("formId", form.id);
    formData.append("name", formName);
    formData.append("fields", JSON.stringify(fieldsToSave));

    // save canvas settings
    formData.append("formulaSettings", JSON.stringify(formulaSettings));
    formData.append("productSettings", JSON.stringify(productSettings));
    formData.append("nonProductSettings", JSON.stringify(nonProductSettings));
    formData.append("advancedSettings", JSON.stringify(advancedSettings));

    //save cart settings
    formData.append("cartSettings", JSON.stringify(cartSettings));

    fetcher.submit(formData, { method: "post", action: "/app/form-builder" });
  };

  // ----- render -----
  return (
    <div style={styles.container}>
      {/* top bar */}
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => navigate("/app/form-builder")} style={styles.backBtn}>
            ← back
          </button>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            style={styles.formNameInput}
            placeholder="form title"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {saved && <span style={{ color: "#047857", fontSize: 14 }}>✓ saved</span>}
          <button 
            onClick={() => navigate(`/app/form-builder-preview/${form.id}`)} 
            style={styles.smallBtn}
          >
            👁️ preview
          </button>
          <button onClick={handleSave} disabled={fetcher.state === "submitting"} style={styles.primaryBtn}>
            {fetcher.state === "submitting" ? "saving..." : "save"}
          </button>
        </div>
      </div>

  {/* main editor */}
  <div style={styles.editorContainer}>
  {/* canvas area */}
  <div style={styles.canvasArea}>
    
    {/* Scrollable canvas content with form elements */}
    <div style={styles.canvasScrollableContent}>
      {components.length === 0 ? (
        <div
          style={styles.dropZonePlaceholder}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h3 style={styles.heading2}>drag elements here</h3>
          <div style={styles.bodyText}>start building your form by dragging elements from the sidebar</div>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {components.map((component, index) => (
            <div
              key={component.id || index}
              draggable={true}
              onDragStart={(e) => handleComponentDragStart(e, index)}
              onDragOver={(e) => handleComponentDragOver(e, index)}
              onDrop={(e) => handleComponentDrop(e, index)}
              onDragEnd={handleComponentDragEnd}
              onClick={() => {
                setSelectedComponentIndex(index);
                setActiveTab("properties");
              }}
              style={{
                ...styles.componentWrapper,
                ...(selectedComponentIndex === index ? styles.componentWrapperSelected : {}),
                ...(draggedIndex === index ? { opacity: 0.5 } : {}),
                ...(dragOverIndex === index && draggedIndex !== index ? { 
                  borderTop: "3px solid #3b82f6",
                  marginTop: "8px"
                } : {}),
                cursor: "grab",
                transition: "all 0.2s ease",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.cursor = "grabbing";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.cursor = "grab";
              }}
            >
              {/* Drag handle so interactive inner elements don't block drag */}
              <div
                draggable
                onDragStart={(e) => { e.stopPropagation(); handleComponentDragStart(e, index); }}
                style={styles.dragHandle}
                title="Drag to reorder"
              >
                ☰
              </div>
              {/* Component action buttons */}
              {selectedComponentIndex === index && (
                <div style={styles.componentActions}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab("properties");
                    }}
                    style={styles.editButton}
                    title="Edit Properties">
                    ✏️ edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateComponent(index);
                    }}
                    style={styles.copyButton}
                    title="Duplicate element"
                  >
                    📋 copy
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeComponent(index);
                    }}
                    style={styles.deleteButton}
                    title="Remove element"
                  >
                    🗑️ remove
                  </button>
                </div>
              )}

              {/* Conditional display badge */}
              {component.conditionalDisplay?.enabled && (
                <div style={styles.conditionalBadge}>⚡ conditional</div>
              )}

              {/* Render the component */}
              <RenderComponent component={component} preview={false} />
            </div>
          ))}
        </div>
      )}

    </div>

    {/* Canvas section tabs - fixed at bottom */}
    <div style={styles.canvasSectionTabsContainer}>
      <CanvasSectionTabs
        activeTab={canvasSectionTab}
        setActiveTab={setCanvasSectionTab}
        formulaSettings={formulaSettings}
        setFormulaSettings={setFormulaSettings}
        productSettings={productSettings}
        setProductSettings={setProductSettings}
        nonProductSettings={nonProductSettings}
        setNonProductSettings={setNonProductSettings}
        advancedSettings={advancedSettings}
        setAdvancedSettings={setAdvancedSettings}
        cartSettings={cartSettings}
        setCartSettings={setCartSettings}
        components={components}
      />
    </div>
  </div>

        {/* sidebar */}
        <div style={styles.sidebar}>
          {/* tabs */}
          <div style={styles.sidebarTabs}>
            <button
              onClick={() => setActiveTab("elements")}
              style={{ ...styles.tabButton, ...(activeTab === "elements" ? styles.tabButtonActive : {}) }}
            >
              elements
            </button>
            <button
              onClick={() => setActiveTab("properties")}
              disabled={selectedComponentIndex === null}
              style={{
                ...styles.tabButton,
                ...(activeTab === "properties" ? styles.tabButtonActive : {}),
                ...(selectedComponentIndex === null ? styles.tabButtonDisabled : {}),
              }}
            >
              properties
            </button>
          </div>

          {/* tab content */}
          <div style={styles.sidebarContent}>
            {activeTab === "elements" ? (
              <ElementsPanel onDragStart={handleDragStart} onAdd={addComponent} />
            ) : (
              selectedComponentIndex !== null && (
                <PropertiesPanel
                  component={components[selectedComponentIndex]}
                  onUpdateLabel={(value) => updateComponent(selectedComponentIndex, "label", value)}
                  onUpdatePlaceholder={(value) => updateComponent(selectedComponentIndex, "placeholder", value)}
                  onUpdateRequired={(value) => updateComponent(selectedComponentIndex, "required", value)}
                  onUpdateStyle={(key, value) => updateComponentStyle(selectedComponentIndex, key, value)}
                  onUpdateOptions={(options) => updateComponentOptions(selectedComponentIndex, options)}
                  onUpdateTooltip={(tooltip) => updateComponentTooltip(selectedComponentIndex, tooltip)}
                  onUpdateSettings={(settings) => updateComponentSettings(selectedComponentIndex, settings)}
                  onUpdateValueRanges={(ranges) => updateComponentValueRanges(selectedComponentIndex, ranges)}
                  onUpdateContent={(content) => updateComponentContent(selectedComponentIndex, content)}
                  onUpdateButtonStyle={(style) => updateComponentButtonStyle(selectedComponentIndex, style)}
                  onUpdateTableData={(data) => updateComponentTableData(selectedComponentIndex, data)}
                  onUpdateConditionalDisplay={(cd) => updateComponentConditionalDisplay(selectedComponentIndex, cd)}
                  allComponents={components}
                  currentIndex={selectedComponentIndex}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

//----------------------canvas section panel-------------------
function CanvasSectionTabs({
  activeTab,
  setActiveTab,
  formulaSettings,
  setFormulaSettings,
  productSettings,
  setProductSettings,
  nonProductSettings,
  setNonProductSettings,
  advancedSettings,
  setAdvancedSettings,
  //props for cart settings
  cartSettings,
  setCartSettings,
  components //pass components for element mapping
}) {
  const addNonProductPage = () => {
    setNonProductSettings((prev) => ({
      ...prev,
      pages: [...prev.pages, { id: Date.now(), pageName: "", pageUrl: "", elementSelector: "" }],
    }));
  };

  const updateNonProductPage = (id, field, value) => {
    setNonProductSettings((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    }));
  };

  const deleteNonProductPage = (id) => {
    setNonProductSettings((prev) => ({
      ...prev,
      pages: prev.pages.filter((p) => p.id !== id),
    }));
  };

  return (
    <div style={{ marginTop: 16, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", padding: "0 12px" }}>
        {["formula", "products", "non-products", "cart", "advanced"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 16px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "#3b82f6" : "#6b7280",
              textTransform: "capitalize",
              position: "relative",
            }}
          >
            {tab === "cart" ? "Cart & Products" : tab }
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: 16 }}>
        {activeTab === "formula" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={propertyStyles.label}>Formula</label>
              <FormulaInput
                value={formulaSettings.formula}
                onChange={(newValue) => setFormulaSettings({ ...formulaSettings, formula: newValue })}
                components={components}
                placeholder="e.g., {Quantity} * ({Size} + {Color})"
                multiline={true}
                showConversion={false}
              />
  
      {/* NEW: Helper text with examples */}
      <div style={{ 
        fontSize: 11, 
        color: "#6b7280", 
        marginTop: 8,
        padding: 10,
        background: "#f0f9ff",
        borderRadius: 6,
        border: "1px solid #bae6fd"
      }}>
        <strong style={{ color: "#0369a1", display: "block", marginBottom: 6 }}>
          💡 Formula Examples:
        </strong>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 3 }}>
              {'{Size}'} + {'{Color}'}
            </code>
            <span style={{ marginLeft: 8 }}>— Add two fields</span>
          </div>
          
          <div>
            <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 3 }}>
              {'{Quantity}'} * ({'{Base Price}'} + {'{Size}'})
            </code>
            <span style={{ marginLeft: 8 }}>— Quantity × total price</span>
          </div>
          
          <div>
            <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 3 }}>
              if({'{Quantity}'} {'>'} 100, {'{Price}'} * 0.85, {'{Price}'})
            </code>
            <span style={{ marginLeft: 8 }}>— 15% bulk discount</span>
          </div>
          
          <div>
            <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 3 }}>
              round({'{Price}'} * 1.08, 2)
            </code>
            <span style={{ marginLeft: 8 }}>— Add 8% tax</span>
          </div>
        </div>
        
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #bae6fd" }}>
          <a 
            href="https://mathjs.org/docs/expressions/syntax.html" 
            target="_blank"
            style={{ color: "#0369a1", textDecoration: "none", fontWeight: 500 }}
          >
            View all Math.js functions →
          </a>
        </div>
      </div>
    </div>

                <div>
                  <label style={propertyStyles.label}>Formula Label</label>
                  <input
                    type="text"
                    value={formulaSettings.formulaLabel}
                    onChange={(e) => setFormulaSettings({ ...formulaSettings, formulaLabel: e.target.value })}
                    style={propertyStyles.input}
                    placeholder="Enter formula label"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={propertyStyles.label}>Minimum Formula Value</label>
                    <input
                      type="number"
                      value={formulaSettings.minFormulaValue}
                      onChange={(e) => setFormulaSettings({ ...formulaSettings, minFormulaValue: e.target.value })}
                      style={propertyStyles.input}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label style={propertyStyles.label}>Formula Decimals</label>
                    <select
                      value={formulaSettings.formulaDecimals}
                      onChange={(e) => setFormulaSettings({ ...formulaSettings, formulaDecimals: e.target.value })}
                      style={propertyStyles.input}
                    >
                      <option value="0">0</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={propertyStyles.label}>Formula Prefix</label>
                    <input
                      type="text"
                      value={formulaSettings.formulaPrefix}
                      onChange={(e) => setFormulaSettings({ ...formulaSettings, formulaPrefix: e.target.value })}
                      style={propertyStyles.input}
                      placeholder="e.g., $"
                    />
                  </div>

                  <div>
                    <label style={propertyStyles.label}>Formula Suffix</label>
                    <input
                      type="text"
                      value={formulaSettings.formulaSuffix}
                      onChange={(e) => setFormulaSettings({ ...formulaSettings, formulaSuffix: e.target.value })}
                      style={propertyStyles.input}
                      placeholder="e.g., USD"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "products" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={propertyStyles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={productSettings.showOnAllProducts}
                    onChange={(e) => setProductSettings({ ...productSettings, showOnAllProducts: e.target.checked })}
                  />
                  <span>Show this calculator on all current and future products</span>
                </label>

                {productSettings.showOnAllProducts && (
                  <div style={{ padding: 12, background: "#eff6ff", borderRadius: 6, fontSize: 13, color: "#1e40af" }}>
                    This calculator will automatically apply to any existing and future products that don't have a specific calculator enabled for it.
                  </div>
                )}

                <div>
                  <label style={propertyStyles.label}>Select Products</label>
                  <button style={{ ...styles.primaryBtn, width: "100%" }}>Choose Shopify Products</button>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                    {productSettings.selectedProducts.length} products selected
                  </div>
                </div>
              </div>
            )}

            {activeTab === "non-products" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {nonProductSettings.pages.map((page) => (
                  <div key={page.id} style={{ padding: 12, background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input
                        type="text"
                        value={page.pageName}
                        onChange={(e) => updateNonProductPage(page.id, "pageName", e.target.value)}
                        placeholder="Enter page name"
                        style={propertyStyles.input}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input
                          type="text"
                          value={page.pageUrl}
                          onChange={(e) => updateNonProductPage(page.id, "pageUrl", e.target.value)}
                          placeholder="Paste page URL here"
                          style={propertyStyles.inputSmall}
                        />
                        <input
                          type="text"
                          value={page.elementSelector}
                          onChange={(e) => updateNonProductPage(page.id, "elementSelector", e.target.value)}
                          placeholder="Paste copied selector"
                          style={propertyStyles.inputSmall}
                        />
                      </div>
                      <button onClick={() => deleteNonProductPage(page.id)} style={{ ...propertyStyles.deleteBtn, width: "100%" }}>
                        🗑️ Remove Page
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={addNonProductPage} style={propertyStyles.addMoreBtn}>
                  + Add Non-Product Page
                </button>
              </div>
            )}

            {activeTab === "cart" && (
              <CartSettingsPanel
                cartSettings = {cartSettings}
                setCartSettings = {setCartSettings}
                components = {components}
              />
            )}

            {activeTab === "advanced" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={propertyStyles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={advancedSettings.archiveCalculator}
                    onChange={(e) => setAdvancedSettings({ ...advancedSettings, archiveCalculator: e.target.checked })}
                  />
                  <span>Archive Calculator</span>
                </label>

                <label style={propertyStyles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={advancedSettings.availableAtAllLocations}
                    onChange={(e) => setAdvancedSettings({ ...advancedSettings, availableAtAllLocations: e.target.checked })}
                  />
                  <span>Available at All Locations</span>
                </label>

                <label style={propertyStyles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={advancedSettings.skuSameAsProduct}
                    onChange={(e) => setAdvancedSettings({ ...advancedSettings, skuSameAsProduct: e.target.checked })}
                  />
                  <span>SKU Same as Product</span>
                </label>

                <label style={propertyStyles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={advancedSettings.variantWeightCalculation}
                    onChange={(e) => setAdvancedSettings({ ...advancedSettings, variantWeightCalculation: e.target.checked })}
                  />
                  <span>Variant Weight Calculation</span>
                </label>

                <label style={propertyStyles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={advancedSettings.variantCostCalculation}
                    onChange={(e) => setAdvancedSettings({ ...advancedSettings, variantCostCalculation: e.target.checked })}
                  />
                  <span>Variant Cost Calculation</span>
                </label>
              </div>
            )}
          </div>
        </div>
      );
    }

// ==================== elements panel ====================
function ElementsPanel({ onDragStart, onAdd }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {ELEMENTS.map((el) => (
        <div
          key={el.type}
          draggable
          onDragStart={(e) => onDragStart(e, el.type)}
          style={{
            padding: 10,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "grab",
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>{el.icon} {el.label}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{el.description}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onAdd(el.type)} style={styles.smallBtn}>add</button>
          </div>
        </div>
      ))}
    </div>
  );
}

//=============photoeditor panel================
function PhotoEditorModal({ isOpen, onClose, onSave, initialImage = null }) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [currentFilter, setCurrentFilter] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [texts, setTexts] = useState([]);
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  // crop & resize state
  const [cropMode, setCropMode] = useState(false);
  const [selection, setSelection] = useState(null); // { x, y, w, h }
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);
  const [resizeW, setResizeW] = useState('');
  const [resizeH, setResizeH] = useState('');

  useEffect(() => {
    if (isOpen && initialImage) {
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = initialImage;
    }
  }, [isOpen, initialImage]);

  useEffect(() => {
    if (image) drawCanvas();
  }, [image, rotation, flipH, flipV, brightness, contrast, currentFilter, texts, zoom]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.scale(zoom, zoom);

    const scale = Math.min((canvas.width * 0.9) / image.width, (canvas.height * 0.9) / image.height);
    const imgWidth = image.width * scale;
    const imgHeight = image.height * scale;

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (currentFilter === 'grayscale') ctx.filter += ' grayscale(100%)';
    if (currentFilter === 'sepia') ctx.filter += ' sepia(100%)';
    if (currentFilter === 'blur') ctx.filter += ' blur(3px)';

    ctx.drawImage(image, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
    ctx.restore();

    // draw selection rectangle if in crop mode
    if (selection) {
      const { x, y, w, h } = selection;
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    texts.forEach(text => {
      ctx.font = `${text.size}px Arial`;
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    });
  };

  // Mouse handlers for crop selection (coordinates in canvas space)
  const toCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (canvasRef.current.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (canvasRef.current.height / rect.height));
    return { x, y };
  };

  const handleCanvasMouseDown = (e) => {
    if (!cropMode) return;
    const pos = toCanvasCoords(e);
    dragStartRef.current = pos;
    setIsDragging(true);
    setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleCanvasMouseMove = (e) => {
    if (!cropMode || !isDragging) return;
    const pos = toCanvasCoords(e);
    const start = dragStartRef.current;
    const x = Math.min(start.x, pos.x);
    const y = Math.min(start.y, pos.y);
    const w = Math.abs(pos.x - start.x);
    const h = Math.abs(pos.y - start.y);
    setSelection({ x, y, w, h });
  };

  const handleCanvasMouseUp = () => {
    if (!cropMode) return;
    setIsDragging(false);
  };

  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selection || selection.w === 0 || selection.h === 0) return;

    const off = document.createElement('canvas');
    off.width = selection.w;
    off.height = selection.h;
    const octx = off.getContext('2d');
    octx.drawImage(canvas, selection.x, selection.y, selection.w, selection.h, 0, 0, selection.w, selection.h);
    const dataUrl = off.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setSelection(null);
      setCropMode(false);
      setZoom(1);
      setResizeW('');
      setResizeH('');
    };
    img.src = dataUrl;
  };

  const cancelCrop = () => {
    setSelection(null);
    setCropMode(false);
  };

  const applyResize = () => {
    if (!image) return;
    const w = parseInt(resizeW, 10);
    const h = parseInt(resizeH, 10);
    if (!w || !h) {
      alert('Enter valid width and height');
      return;
    }
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(image, 0, 0, w, h);
    const dataUrl = off.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(1);
      setResizeW('');
      setResizeH('');
    };
    img.src = dataUrl;
  };

  const handleAddText = () => {
    if (textInput.trim()) {
      setTexts([...texts, { text: textInput, x: 400, y: 300, color: textColor, size: 24 }]);
      setTextInput('');
      setTextMode(false);
    }
  };

  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCurrentFilter(null);
    setBrightness(100);
    setContrast(100);
    setTexts([]);
    setZoom(1);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Export at the image's intrinsic pixel dimensions (preserve quality)
      if (!image) return;

      const origW = image.width;
      const origH = image.height;
      let outW = origW;
      let outH = origH;
      const rot = ((rotation % 360) + 360) % 360;
      if (rot === 90 || rot === 270) {
        outW = origH;
        outH = origW;
      }

      const off = document.createElement('canvas');
      off.width = outW;
      off.height = outH;
      const ctx = off.getContext('2d');

      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      let filterStr = `brightness(${brightness}%) contrast(${contrast}%)`;
      if (currentFilter === 'grayscale') filterStr += ' grayscale(100%)';
      if (currentFilter === 'sepia') filterStr += ' sepia(100%)';
      if (currentFilter === 'blur') filterStr += ' blur(3px)';
      ctx.filter = filterStr;

      ctx.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
      ctx.restore();

      // draw texts scaled from editor canvas space to output image space
      const editorW = canvasRef.current?.width || 800;
      const editorH = canvasRef.current?.height || 600;
      const scaleX = outW / editorW;
      const scaleY = outH / editorH;
      const avgScale = (scaleX + scaleY) / 2;
      texts.forEach(text => {
        ctx.font = `${Math.round((text.size || 24) * avgScale)}px Arial`;
        ctx.fillStyle = text.color || '#000';
        const x = Math.round((text.x || 0) * scaleX);
        const y = Math.round((text.y || 0) * scaleY);
        ctx.fillText(text.text || '', x, y);
      });

      const dataUrl = off.toDataURL('image/png', 0.9);
      onSave(dataUrl);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={photoEditorStyles.overlay} onClick={onClose}>
      <div style={photoEditorStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={photoEditorStyles.header}>
          <h2 style={photoEditorStyles.modalTitle}>📸 Photo Editor</h2>
          <button onClick={onClose} style={photoEditorStyles.closeBtn}>✕</button>
        </div>

        <div style={photoEditorStyles.body}>
          <div style={photoEditorStyles.canvasWrap}>
            <canvas 
              ref={canvasRef} 
              style={photoEditorStyles.canvas} 
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            />
          </div>

          <div style={photoEditorStyles.toolbar}>
            <div style={photoEditorStyles.toolRow}>
              <span style={photoEditorStyles.label}>Transform:</span>
              <button onClick={() => setRotation((rotation + 90) % 360)} style={photoEditorStyles.btn}>🔄 Rotate</button>
              <button onClick={() => setFlipH(!flipH)} style={photoEditorStyles.btn}>↔️ Flip H</button>
              <button onClick={() => setFlipV(!flipV)} style={photoEditorStyles.btn}>↕️ Flip V</button>
            </div>

            <div style={photoEditorStyles.toolRow}>
              <span style={photoEditorStyles.label}>Filters:</span>
              <button 
                onClick={() => setCurrentFilter(currentFilter === 'grayscale' ? null : 'grayscale')} 
                style={{...photoEditorStyles.btn, ...(currentFilter === 'grayscale' ? photoEditorStyles.btnActive : {})}}>
                ⚫ Gray
              </button>
              <button 
                onClick={() => setCurrentFilter(currentFilter === 'sepia' ? null : 'sepia')}
                style={{...photoEditorStyles.btn, ...(currentFilter === 'sepia' ? photoEditorStyles.btnActive : {})}}>
                🟤 Sepia
              </button>
              <button 
                onClick={() => setCurrentFilter(currentFilter === 'blur' ? null : 'blur')}
                style={{...photoEditorStyles.btn, ...(currentFilter === 'blur' ? photoEditorStyles.btnActive : {})}}>
                💨 Blur
              </button>
            </div>

            <div style={photoEditorStyles.toolRow}>
              <span style={photoEditorStyles.label}>Brightness:</span>
              <input type="range" min="0" max="200" value={brightness} onChange={e => setBrightness(e.target.value)} style={photoEditorStyles.slider} />
              <span style={photoEditorStyles.value}>{brightness}%</span>
            </div>

            <div style={photoEditorStyles.toolRow}>
              <span style={photoEditorStyles.label}>Contrast:</span>
              <input type="range" min="0" max="200" value={contrast} onChange={e => setContrast(e.target.value)} style={photoEditorStyles.slider} />
              <span style={photoEditorStyles.value}>{contrast}%</span>
            </div>

            <div style={photoEditorStyles.toolRow}>
              <span style={photoEditorStyles.label}>Zoom:</span>
              <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} style={photoEditorStyles.btn}>🔍-</button>
              <span style={photoEditorStyles.value}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} style={photoEditorStyles.btn}>🔍+</button>
            </div>

            <div style={photoEditorStyles.toolRow}>
              <span style={photoEditorStyles.label}>Crop:</span>
              <button onClick={() => { setCropMode(!cropMode); setSelection(null); }} style={{...photoEditorStyles.btn, ...(cropMode ? photoEditorStyles.btnActive : {})}}>
                ✂️ {cropMode ? 'Exit' : 'Crop'}
              </button>
              {cropMode && (
                <>
                  <button onClick={applyCrop} style={photoEditorStyles.btn}>✅ Apply</button>
                  <button onClick={cancelCrop} style={photoEditorStyles.btn}>✕ Cancel</button>
                </>
              )}
            </div>

            <div style={photoEditorStyles.toolRow}>
              <span style={photoEditorStyles.label}>Resize:</span>
              <input type="number" placeholder="W" value={resizeW} onChange={e=>setResizeW(e.target.value)} style={{...photoEditorStyles.input, width:80}} />
              <input type="number" placeholder="H" value={resizeH} onChange={e=>setResizeH(e.target.value)} style={{...photoEditorStyles.input, width:80}} />
              <button onClick={applyResize} style={photoEditorStyles.btn}>↔️ Apply</button>
            </div>

            <div style={photoEditorStyles.toolRow}>
              {!textMode ? (
                <button onClick={() => setTextMode(true)} style={photoEditorStyles.btn}>📝 Add Text</button>
              ) : (
                <>
                  <input 
                    type="text" 
                    value={textInput} 
                    onChange={e => setTextInput(e.target.value)} 
                    placeholder="Text..." 
                    style={photoEditorStyles.input} 
                  />
                  <input 
                    type="color" 
                    value={textColor} 
                    onChange={e => setTextColor(e.target.value)} 
                    style={photoEditorStyles.color} 
                  />
                  <button onClick={handleAddText} style={photoEditorStyles.btn}>✓</button>
                  <button onClick={() => setTextMode(false)} style={photoEditorStyles.btn}>✕</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={photoEditorStyles.footer}>
          <button onClick={handleReset} style={photoEditorStyles.resetBtn}>🔄 Reset</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onClose} style={photoEditorStyles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={photoEditorStyles.saveBtn}>💾 Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}



//=========file upload component=================
function FileUploadComponent({ 
  onFileSelect, 
  acceptedFormats = ['.jpg', '.jpeg', '.png', '.pdf'], 
  maxSize = 10 
}){
    const [dragActive, setDragActive] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(e.type === "dragenter" || e.type === "dragover"){
        setDragActive(true);
      } else if (e.type === "dragleave"){
        setDragActive(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if(e.dataTransfer.files && e.dataTransfer.files[0]){
        handleFile(e.dataTransfer.files[0]);
      }
    };

    const handleChange = (e) => {
      e.preventDefault();
      if(e.target.files && e.target.files[0]){
        handleFile(e.target.files[0]);
      }
    };

    const handleFile = (file) => {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        alert(`File size exceeds ${maxSize}MB limit`);
        return;
      }

      const fileExt = '.' + file.name.split('.').pop().toLowerCase();
      if (!acceptedFormats.includes(fileExt)) {
        alert(`Please upload only ${acceptedFormats.join(', ')} files`);
        return;
      }

      setUploadedFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        onFileSelect({
          file: file,
          dataUrl: reader.result,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      };
      reader.readAsDataURL(file);
    };

    const handleRemove = () => {
      setUploadedFile(null);
      onFileSelect(null);
      if(fileInputRef.current){
        fileInputRef.current.value = '';
      }
    };

    return (
      <div style={{ width: '100%'}}>
        {!uploadedFile ? (
          <div style={{
            border: dragActive ? '2px dashed #3b82f6' : '2px dashed #d1d5db',
            borderRadius: 8,
            padding: 40,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: dragActive ? '#eff6ff' : '#f9fafb',
          }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFormats.join(',')}
              onChange={handleChange}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
            <div style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
              <strong>Click to upload</strong> or drag and drop
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {acceptedFormats.join(', ').toUpperCase()} up to {maxSize}MB
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>
                {uploadedFile.type.startsWith('image/') ? '🖼️' : '📄'}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#166534' }}>
                  {uploadedFile.name}
                </div>
                <div style={{ fontSize: 12, color: '#16a34a' }}>
                  {(uploadedFile.size / 1024).toFixed(2)} KB
                </div>
              </div>
            </div>
            <button
              onClick={handleRemove}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: '#fee2e2',
                color: '#991b1b',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              🗑️ Remove
            </button>
          </div>        
        )}
      </div>
    );
}

//===============data lookup properties panel============
function DataLookupPropertiesPanel({ tableData, settings, onUpdateTableData, onUpdateSettings}){
  //showTableEditor state variable
  //tracks whether the table editor panel is open or closed
  const [showTableEditor, setShowTableEditor] = useState(false);

  return (
    <>
      {/* section 1: data lookup header with update data button */}
      <div style={propertyStyles.sectionBlue}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ ...propertyStyles.label, marginBottom: 0 }}>📊 Data Lookup</label>

          {/* toggle button: opens/closes the table editor modal */}
          <button
            onClick={() => setShowTableEditor(!showTableEditor)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: showTableEditor ? "#ef4444" : "#3b82f6",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {showTableEditor ? '✕ Close' : '📝 Update Data'}
          </button>
        </div>

        {/* section 2: table status indicator */}
        {tableData && tableData.rows && tableData.rows.length > 0 ? (
          <div style={{
              padding: 10,
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: 6,
              fontSize: 12,
              color: '#065f46',
              marginBottom: 12,
          }}>
            ✅ Table configured: {tableData.rows.length} rows × {tableData.columnHeaders?.length || 0} columns
          </div>
        ) : (
          <div style={{
            padding: 10,
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: 6,
            fontSize: 12,
            color: '#92400e',
            marginBottom: 12,
          }}>
            No lookup table configured. Click "Update Data" to add data.
          </div>
        )}
      </div>

      {/* section 3: Full-screen modal for table editor */}
{showTableEditor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
        onClick={() => setShowTableEditor(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 12,
            width: '95%',
            height: '90vh',
            maxWidth: '1400px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f9fafb'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
                  📊 Data Lookup Table Editor
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
                  Configure your lookup table for {settings?.input1Name || "Input 1"} × {settings?.input2Name || "Input 2"}
                </p>
              </div>
              <button
                onClick={() => setShowTableEditor(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 28,
                  cursor: 'pointer',
                  color: '#9ca3af',
                  lineHeight: 1,
                  padding: '0 8px',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
              >
                ×
              </button>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 24
            }}>
              <DataLookupTableEditor
                tableData={tableData}
                onChange={onUpdateTableData}
                settings={settings}
              />
            </div>

            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f9fafb'
            }}>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                💡 Changes are saved automatically
              </div>
              <button
                onClick={() => setShowTableEditor(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                ✓ Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={propertyStyles.sectionWhite}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: "#374151" }}>
          Input 1 Configuration
        </div>
        
        <label style={propertyStyles.labelSmall}>Input 1 Name</label>
        <input
          type="text"
          value={settings?.input1Name || "Input 1"}
          onChange={(e) => onUpdateSettings({ ...(settings || {}), input1Name: e.target.value })}
          style={propertyStyles.input}
          placeholder="Input 1"
        />

        <label style={{ ...propertyStyles.checkboxLabel, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={settings?.input1Formula || false}
            onChange={(e) => onUpdateSettings({ ...(settings || {}), input1Formula: e.target.checked })}
          />
          <span>Is Input 1 based on formula?</span>
        </label>

        {settings?.input1Formula && (
          <>
            <label style={{ marginTop: 8, display: "block", fontSize: 12 }}>
              Formula for Input 1
            </label>
            <input
              type="text"
              value={settings?.input1FormulaText || ""}
              onChange={(e) => onUpdateSettings({ ...(settings || {}), input1FormulaText: e.target.value })}
              style={propertyStyles.input}
              placeholder="e.g., [element_1] * 2"
            />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              This input will be hidden and automatically calculated
            </div>
          </>
        )}

        <label style={{ marginTop: 8, display: "block", fontSize: 12 }}>
          Maximum Decimal
        </label>
        <input
          type="range"
          min="0"
          max="10"
          value={settings?.input1MaxDecimal || 0}
          onChange={(e) => onUpdateSettings({ ...(settings || {}), input1MaxDecimal: parseInt(e.target.value, 10) })}
          style={{ width: "100%" }}
        />
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Current: {settings?.input1MaxDecimal || 0}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div>
            <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
              Min Value
            </label>
            <input
              type="number"
              value={settings?.input1MinValue || "0"}
              onChange={(e) => onUpdateSettings({ ...(settings || {}), input1MinValue: e.target.value })}
              style={propertyStyles.inputSmall}
              placeholder="0"
            />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
              Auto-set from first table value (B1)
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
              Max Value
            </label>
            <input
              type="number"
              value={settings?.input1MaxValue || "10000"}
              onChange={(e) => onUpdateSettings({ ...(settings || {}), input1MaxValue: e.target.value })}
              style={propertyStyles.inputSmall}
              placeholder="10000"
            />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
              Values beyond last column use last column data
            </div>
          </div>
        </div>
      </div>

      <div style={propertyStyles.sectionBlue}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: "#374151" }}>
          Input 2 Configuration
        </div>
        
        <label style={propertyStyles.labelSmall}>Input 2 Name</label>
        <input
          type="text"
          value={settings?.input2Name || "Input 2"}
          onChange={(e) => onUpdateSettings({ ...(settings || {}), input2Name: e.target.value })}
          style={propertyStyles.input}
          placeholder="Input 2"
        />

        <label style={{ ...propertyStyles.checkboxLabel, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={settings?.input2Formula || false}
            onChange={(e) => onUpdateSettings({ ...(settings || {}), input2Formula: e.target.checked })}
          />
          <span>Is Input 2 based on formula?</span>
        </label>

        {settings?.input2Formula && (
          <>
            <label style={{ marginTop: 8, display: "block", fontSize: 12 }}>
              Formula for Input 2
            </label>
            <input
              type="text"
              value={settings?.input2FormulaText || ""}
              onChange={(e) => onUpdateSettings({ ...(settings || {}), input2FormulaText: e.target.value })}
              style={propertyStyles.input}
              placeholder="e.g., [element_2] + 5"
            />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              This input will be hidden and automatically calculated
            </div>
          </>
        )}

        <label style={{ marginTop: 8, display: "block", fontSize: 12 }}>
          Maximum Decimal
        </label>
        <input
          type="range"
          min="0"
          max="10"
          value={settings?.input2MaxDecimal || 0}
          onChange={(e) => onUpdateSettings({ ...(settings || {}), input2MaxDecimal: parseInt(e.target.value, 10) })}
          style={{ width: "100%" }}
        />
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Current: {settings?.input2MaxDecimal || 0}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div>
            <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
              Min Value
            </label>
            <input
              type="number"
              value={settings?.input2MinValue || "0"}
              onChange={(e) => onUpdateSettings({ ...(settings || {}), input2MinValue: e.target.value })}
              style={propertyStyles.inputSmall}
              placeholder="0"
            />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
              Auto-set from first table value (A2)
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
              Max Value
            </label>
            <input
              type="number"
              value={settings?.input2MaxValue || "10000"}
              onChange={(e) => onUpdateSettings({ ...(settings || {}), input2MaxValue: e.target.value })}
              style={propertyStyles.inputSmall}
              placeholder="10000"
            />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
              Values beyond last row use last row data
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

//=========data_lookup panel===================
//wrapper component that passes setttings to ExcelStyleDataLookup
//this wrapper handles settings extraction, ExcelStyleDataLookup handles ui rendering
function DataLookupTableEditor({ tableData, onChange, settings = {}}) {
  return (
    <ExcelStyleDataLookup
      input1Name={settings?.input1Name || "Input 1"}  // Pass custom name or default

      input2Name={settings?.input2Name || "Input 2"}  // Pass custom name or default

      tableData={tableData}                            // Pass existing data

      onChange={onChange} 
    />
  );
}

//================ExcelStyleDataLookup==================
//here rows = input 1 values, columns = input 2 values

function ExcelStyleDataLookup({
  input1Name = "Input 1",
  input2Name = "Input 2",
  tableData,
  onChange
}){

  //purose of columnHeaders: store the column header values[input 2 values - horizontal]
  //
  const [columnHeaders, setColumnHeaders] = useState(
    tableData?.columnHeaders || ['100', '1000', '2500', '5000', '10000', '25000', '50000', '75000']
  );

  //rows purpose store all all row data [ input 1 values + output values for each column]
    const [rows, setRows] = useState(
    tableData?.rows || [
      { id: 1, header: '10', values: ['', '', '', '', '', '', '', ''] },
      { id: 2, header: '20', values: ['', '', '', '', '', '', '', ''] },
      { id: 3, header: '30', values: ['', '', '', '', '', '', '', ''] },
      { id: 4, header: '40', values: ['', '', '', '', '', '', '', ''] },
      { id: 5, header: '50', values: ['', '', '', '', '', '', '', ''] },
      { id: 6, header: '60', values: ['', '', '', '', '', '', '', ''] },
      { id: 7, header: '70', values: ['', '', '', '', '', '', '', ''] },
      { id: 8, header: '80', values: ['', '', '', '', '', '', '', ''] },
      { id: 9, header: '90', values: ['', '', '', '', '', '', '', ''] },
      { id: 10, header: '100', values: ['', '', '', '', '', '', '', ''] },
      { id: 11, header: '110', values: ['', '', '', '', '', '', '', ''] },
      { id: 12, header: '120', values: ['', '', '', '', '', '', '', ''] },
      { id: 13, header: '130', values: ['', '', '', '', '', '', '', ''] },
      { id: 14, header: '140', values: ['', '', '', '', '', '', '', ''] }
    ]
  );

  //notifyChange function : tell the parent component that data has changed
  //parent needs to know to save the updated data to the database
  //it calls the onChange prop with the new data structure
  //newColumnHeaders: updated array of column header strings
  //newRows: updated array of row objects

   const notifyChange = (newColumnHeaders, newRows) => {
    if(onChange){
      onChange({
        columnHeaders: newColumnHeaders,
        rows: newRows
      });
    }
  };

  //updateColumnHeader function
  //purpose: update a single colum header when user types in it
  //cause user needs to define what input 2 value means
   const updateColumnHeader = (index, value) => {
    const newHeaders = [...columnHeaders];  // Spread operator creates shallow copy
    newHeaders[index] = value;              // Update the specific header
    setColumnHeaders(newHeaders);           // Update React state (triggers re-render)
    notifyChange(newHeaders, rows);         // Tell parent about the change
  };


  //updateRowHeader function
  //to update a single row header(input 1 value)
  //cause user needs to define what input 1 value means
  const updateRowHeader = (index, value) => {
    const newRows = [...rows];       // Copy all rows
    newRows[index].header = value;   // Update the header of specific row
    setRows(newRows);                // Update state
    notifyChange(columnHeaders, newRows);  // Notify parent
  };

  //updateCell function
  //used to update a single data cell(output value) when user types
  //user needs to enter the lookup result(prices, quantities)
  const updateCell = (rowIndex, colIndex, value) => {
    const newRows = [...rows];                      // Copy all rows
    newRows[rowIndex].values[colIndex] = value;     // Navigate: row -> values array -> specific index
    setRows(newRows);                               // Update state
    notifyChange(columnHeaders, newRows);           // Notify parent
  };

  //addColumn function
  //add a new colum to the right side of the table
  //user might need more input 2 values that defaault 8
   const addColumn = () => {
    const newHeaders = [...columnHeaders, ''];  // Add empty column header
    const newRows = rows.map(row => ({          // Transform each row
      ...row,                                   // Keep all existing properties
      values: [...row.values, '']               // Add empty value at end
    }));
    setColumnHeaders(newHeaders);               // Update both states
    setRows(newRows);
    notifyChange(newHeaders, newRows);          // Notify parent of both changes
  };

  //addRow function
  //add a new row to the bottom of the table
  //user might need more input 1 value than default 14
    const addRow = () => {
    const newRow = {
      id: Date.now(),                                // Unique ID using timestamp
      header: '',                                    // Empty Input 1 value (user will fill)
      values: new Array(columnHeaders.length).fill('') // Create array of empty strings
      // If 8 columns exist, creates ['', '', '', '', '', '', '', '']
    };
    const newRows = [...rows, newRow];  // Append to end
    setRows(newRows);                   // Update state
    notifyChange(columnHeaders, newRows);  // Notify parent
  };

  //deleteColumn function
  //remove a column from the table
  const deleteColumn = (index) => {
    if (columnHeaders.length <= 1) {     // Guard clause
      alert('Must have at least 1 column');
      return;  // Exit function early
    }
    // Filter creates new array excluding items where condition is false
    const newHeaders = columnHeaders.filter((_, i) => i !== index);
    const newRows = rows.map(row => ({
      ...row,
      values: row.values.filter((_, i) => i !== index)  // Remove value at same index
    }));
    setColumnHeaders(newHeaders);
    setRows(newRows);
    notifyChange(newHeaders, newRows);
  };

  //deleteRow function
  //remove a row from the table
  const deleteRow = (index) => {
    if (rows.length <= 1) {              // Guard clause
      alert('Must have at least 1 row');
      return;
    }
    const newRows = rows.filter((_, i) => i !== index);  // Remove row at index
    setRows(newRows);
    notifyChange(columnHeaders, newRows);
  };

  return (
    <div style={{
      background: "#fff",
      padding: 12,
      borderRadius: 8,
      border: "1px solid #e5e7eb"
    }}>
      {/*section 1: action button for adding rows and columns*/}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8}}>
        <button onClick={addRow}
          style={{
            padding: '8px 16px', //vertical 6px, horizontal 12px
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500
        }}>
          ➕ Add Row
        </button>
        <button onClick={addColumn}
          style={{
            padding: '8px 16px', //vertical 6px, horizontal 12px
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500
        }}>
          ➕ Add Column
        </button>
      </div>

      {/*section 2: excel style table, display the main data grid
      horizontal scroll container*/}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'auto' }}>
        <table style={{
          width: 'auto', 
          borderCollapse: 'collapse',
          border: '1px solid #9ca3af',
          fontSize: 14
        }}>
          <thead>
            <tr>
              <th style={{
                background: '#d1d5db',
                border: '1px solid #9ca3af',
                padding: '4px', 
                minWidth: 60,   
                width: 60       
              }}>
              </th>
              <th colSpan={columnHeaders.length + 1}
              style={{
                background: '#f97316',
                border: '1px solid #9ca3af',
                padding: '6px', 
                textAlign: 'center',
                fontSize: 11,   
                fontWeight: 700,
                color: '#fff'
              }}
              >
                {input2Name}
              </th>
            </tr>
            
            <tr>
              <th style={{
                background: '#60a5fa',
                border: '1px solid #9ca3af',
                padding: '4px 2px', 
                textAlign: 'center',
                fontSize: 10,       
                fontWeight: 700,
                color: '#fff',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                minWidth: 60,      
                width: 60,         
                height: 100        
              }}>
                {input1Name}
              </th>
              
              {columnHeaders.map((header, index) => (
                <th key={index} style={{
                  background: '#60a5fa',
                  border: '1px solid #9ca3af',
                  padding: 0,
                  minWidth: 50,    
                  width: 50,       
                  position: 'relative'
                }}>
                  <input
                    type="text"
                    value={header}
                    onChange={(e) => updateColumnHeader(index, e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      padding: '4px 2px',  
                      background: 'transparent',
                      fontSize: 10,     
                      fontWeight: 600,
                      color: '#fff',
                      textAlign: 'center',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    onClick={() => deleteColumn(index)}
                    style={{
                      position: 'absolute',
                      top: 1,         
                      right: 1,       
                      width: 12,       
                      height: 12,      
                      padding: 0,
                      border: 'none',
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: 2,
                      cursor: 'pointer',
                      fontSize: 8,     
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Delete column"
                  >
                    ×
                  </button>
                </th>
              ))}

              <th style={{
                background: '#d1d5db',
                border: '1px solid #9ca3af',
                padding: 4,    
                width: 24       
              }}>
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td style={{
                  background: '#60a5fa',
                  border: '1px solid #9ca3af',
                  padding: 0
                }}>
                  <input
                    type="text"
                    value={row.header}
                    onChange={(e) => updateRowHeader(rowIndex, e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      padding: '3px 4px',  
                      background: 'transparent',
                      fontSize: 10,     
                      fontWeight: 600,
                      color: '#fff',
                      textAlign: 'center',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </td>

                {row.values.map((value, colIndex) => (
                  <td key={colIndex} style={{
                    background: '#fff',
                    border: '1px solid #d1d5db',
                    padding: 0
                  }}>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                      style={{
                        width: '100%',
                        border: 'none',
                        padding: '3px 4px',  
                        background: 'transparent',
                        fontSize: 10,     
                        textAlign: 'center',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </td>
                ))}

                <td style={{
                    background: '#f9fafb',
                    border: '1px solid #d1d5db',
                    padding: 2,      
                    textAlign: 'center'
                  }}>
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      style={{
                        width: 20,      
                        height: 20,     
                        padding: 0,
                        border: 'none',
                        background: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontSize: 12,      
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto'
                      }}
                      title="Delete row"
                    >
                      🗑️
                    </button>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*Smaller info box */}
      <div style={{ 
        marginTop: 10,         
        padding: 8,            
        background: '#eff6ff',
        borderRadius: 4,      
        fontSize: 11,          
        color: '#1e40af'
      }}>
        <strong>💡 How it works:</strong> Orange header shows "{input2Name}" values (columns), Blue vertical text shows "{input1Name}" values (rows), White cells contain lookup results.
      </div>
    </div>
  )
}




//=============typography panel=========
function TypographyControls({
  compStyles,
  onUpdateStyle,
  showAlignment = true,
  showColors = true,
  showSpacing = false,
  fontSizeRange = { min: 12, max: 96},
  labelPrefix = ""
}){
  return(
    <>
    {/* typograchy section */}
    <div style={propertyStyles.sectionBlue}>
     <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12}}>
      <span style={{ fontSize: 18 }}>🔤</span>
      <label style={{...propertyStyles.label, marginBottom: 0}}>
        {labelPrefix}Typography
      </label>
     </div>

     {/*font family*/}
     <div style={{marginBottom: 12}}>
      <label style={propertyStyles.labelSmall}>Font Family</label>
      <select
        value={compStyles?.fontFamily || "Inter, system-ui, sans-serif"}
        onChange={(e) => onUpdateStyle("fontFamily", e.target.value)}
        style={propertyStyles.input}
      >
        <optgroup label="Modern Fonts">
              {POPULAR_FONTS.filter(f => f.category === "Modern").map(font => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
        </optgroup>
        <optgroup label="Elegant Fonts">
              {POPULAR_FONTS.filter(f => f.category === "Elegant").map(font => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
        </optgroup>
        <optgroup label="Classic Fonts">
              {POPULAR_FONTS.filter(f => f.category === "Classic").map(font => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
        </optgroup>
        <optgroup label="Monospace Fonts">
              {POPULAR_FONTS.filter(f => f.category === "Monospace").map(font => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
        </optgroup>
      </select>
     </div>

    {/* font size and weight */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
      <div>
        <label style={propertyStyles.labelSmall}>Font Size</label>
        <div style={{ display: "flex", gap: 4}}>
          <input
          type="number"
          value={parseInt(compStyles?.fontSize || "16")}
          onChange={(e) => onUpdateStyle("fontSize", `${e.target.value}px`)}
          style={{...propertyStyles.inputSmall, flex: 1}}
          min={fontSizeRange.min}
          max={fontSizeRange.max}
          />
          <span style={{ padding: "6px 8px", background: "#f3f4f6", borderRadius: 4, fontSize: 12 }}>
            px
          </span>
        </div>
      </div>


      <div>
       <label style={propertyStyles.labelSmall}>Font Weight</label>
        <select
        value={compStyles?.fontWeight || "400"}
        onChange={(e) => onUpdateStyle("fontWeight", e.target.value)}
        style={propertyStyles.inputSmall}
        >
          <option value="300">Light(300)</option>
          <option value="400">Regular(400)</option>
          <option value="500">Medium(500)</option>
          <option value="600">Semibold(600)</option>
          <option value="700">Bold(700)</option>
          <option value="800">Extra Bold(800)</option>
          <option value="900">Black(900)</option>
        </select>
      </div>
    </div>

    {/* line height and letter spacing */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div>
        <label style={propertyStyles.labelSmall}>Line Height</label>
        <select
          value={compStyles?.lineHeight || "1.5" }
          onChange={(e) => onUpdateStyle("lineHeight", e.target.value)}
          style={propertyStyles.inputSmall}
        >
          <option value="1">1</option>
          <option value="1.2">1.2</option>
          <option value="1.5">1.5</option>
          <option value="1.8">1.8</option>
          <option value="2">2</option>
          <option value="2.5">2.5</option>
        </select>
      </div>

      <div>
        <label style={propertyStyles.labelSmall}>Letter Spacing</label>
        <div style={{ display: "flex", gap: 4}}>
          <input
          type="number"
          value={parseFloat(compStyles?.letterSpacing || "8" )}
          onChange={(e) =>onUpdateStyle("letterSpacing", `${e.target.value}px`)}
          style={{...propertyStyles.inputSmall, flex: 1 }}
          min="-5"
          max="10"
          step="0.5"
          />
          <span style={{ padding: "6px 8px", background: "#f3f4f6", borderRadius: 4, fontSize: 12 }}>
            px
          </span>
        </div>
      </div>
    </div>
  </div>

  {/*text alignment*/}
  {showAlignment && (
    <div style={propertyStyles.sectionWhite}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 18 }}>⚖️</span>
      <label style={{...propertyStyles.label, marginBottom: 0 }}>
        Text Alignment
      </label>
      </div>


      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {[
        { value: "left", icon: "≡", label: "Left" },
        { value: "center", icon: "≣", label: "Center" },
        { value: "right", icon: "≡", label: "Right" },
        { value: "justify", icon: "☰", label: "Justify" }
      ].map(align => (
        <button
        key={align.value}
        onClick={()=>onUpdateStyle("textAlign", align.value)}
        style={{
          padding: "8px",
          background: compStyles?.textAlign === align.value ? "#dbeafe" : "#fff",
          border: compStyles?.textAlign === align.value ? "2px solid #3b82f6" : "1px solid #e5e7eb",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 18,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          transition: "all 0.2s"
        }}
          title={align.label}
        >
          <span>{align.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 500 }}>{align.label}</span>
        </button>
      ))}
      </div>
    </div>
  )}

  {/*colors*/}
  {showColors && (
    <div style={propertyStyles.sectionBlue}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🎨</span>
        <label style={{ ...propertyStyles.label, marginBottom: 0 }}>Colors</label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/*text color*/}

        <div>
          <label style={propertyStyles.labelSmall}>Text Color</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center"}}>
            <input
            type="color"
            value={compStyles?.textColor || "#374151"}
            onChange={(e) => onUpdateStyle("textColor", e.target.value)}
            style={{ width: 50, height: 40, border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer" }}
            />
            <input
            type="text"
            value={compStyles?.textColor || "#374151"}
            onChange={(e) => onUpdateStyle("textColor", e.target.value)}
            style={{ ...propertyStyles.inputSmall, flex: 1 }}
            placeholder="#374151"
            />
          </div>

          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {["#000000", "#1f2937", "#374151", "#3b82f6", "#10b981", "#ef4444"].map(color => (
              <button
                key={color}
                onClick={()=>onUpdateStyle("textColor", color)}
                style={{
                  width: 24,
                  height: 24,
                  background: color,
                  border: compStyles?.textColor === color ? "2px solid #000" : "1px solid #e5e7eb",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
                title={color}
              />
            ))}
          </div>
        </div>


        {/*background color*/}
        <div>
          <label style={propertyStyles.labelSmall}>Background Color</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="color"
              value={compStyles?.bgColor === "transparent" ? "#ffffff":
                (compStyles?.bgColor || "#ffffff")}
              onChange={(e) => onUpdateStyle("bgColor", e.target.value)}
              style={{ width: 50, height: 40, border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer" }}
            />
            <input
            type="text"
            value={compStyles?.bgColor || "transparent"}
            onChange={(e) => onUpdateStyle("bgColor", e.target.value)}
            style={{...propertyStyles.inputSmall, flex: 1 }}
            placeholder="transparent"
            />
          </div>

          <div style={{ display: "flex", gap: 4, marginTop: 8}}>
            <button
            onClick={() => onUpdateStyle("bgColor", "transparent")}
            style={{
              width: 24,
              height: 24,
              background: "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)",
              backgroundSize: "8px 8px",
              backgroundPosition: "0 0, 4px 4px",
              border: compStyles?.bgColor === "transparent" ? "2px solid #000" : "1px solid #e5e7eb",
              borderRadius: 4,
              cursor: "pointer"
            }}
            title="Transparent"
            />
            {["#ffffff", "#f9fafb", "#dbeafe", "#fef3c7", "#fee2e2", "#f3e8ff"].
            map(color => (
              <button
              key={color}
              onClick={() => onUpdateStyle("bgColor", color)}
              style={{
                width: 24,
                height: 24,
                background: color,
                border: compStyles?.bgColor === color ? "2px solid #000" : "1px solid #e5e7eb",
                borderRadius: 4,
                cursor: "pointer"
              }}
              title={color}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )}

  {/*spacing*/}
  {showSpacing && (
    <div style={propertyStyles.sectionWhite}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>📏</span>
        <label style={{ ...propertyStyles.label, marginBottom: 0 }}>Spacing</label>
      </div>

      <div>
        <label style={propertyStyles.labelSmall}>Padding (Vertical)</label>
        <div style={{ display: "flex", gap: 4 }}>
            <input
              type="number"
              value={parseInt(compStyles?.padding || "20")}
              onChange={(e) => onUpdateStyle("padding", `${e.target.value}px 0`)}
              style={{ ...propertyStyles.inputSmall, flex: 1 }}
              min="0"
              max="100"
            />
            <span style={{ padding: "6px 8px", background: "#f3f4f6", borderRadius: 4, fontSize: 12 }}>
              px
            </span>
        </div>
      </div>


      <div style={{ marginTop: 12}}>
          <label style={propertyStyles.labelSmall}>Bottom Margin</label>
          <div style={{ display: "flex", gap: 4}}>
            <input
              type="number"
              value={parseInt(compStyles?.marginBottom || "24")}
              onChange={(e) => onUpdateStyle("marginBottom", `${e.target.value}px`)}
              style={{ ...propertyStyles.inputSmall, flex: 1 }}
              min="0"
              max="100"
            />
            <span style={{ padding: "6px 8px", background: "#f3f4f6", borderRadius: 4, fontSize: 12 }}>
              px
            </span>
          </div>
      </div>
    </div>
  )}

  </>
  )
}

// ==================== properties panel ====================

function PropertiesPanel({
  component = {},
  onUpdateLabel,
  onUpdatePlaceholder,
  onUpdateRequired,
  onUpdateStyle,
  onUpdateOptions,
  onUpdateTooltip,
  onUpdateSettings,
  onUpdateValueRanges,
  onUpdateContent,
  onUpdateButtonStyle,
  onUpdateTableData,
  onUpdateConditionalDisplay,
  allComponents = [],
  currentIndex,
}) {
  const {
    type,
    label,
    placeholder,
    required,
    styles: compStyles,
    options = [],
    tooltip = { enabled: false, text: "" },
    settings = {},
    content = {},
    buttonStyle = {},
    valueRanges = [],
    tableData = null,
    conditionalDisplay = {
      enabled: false,
      valueWhenNotDisplayed: "1",
      triggerElementId: null,
    },
    additionalInfo,
  } = component;

  //helpers for options/value ranges
  const addOption = () => {
    const newOption = {
      id: Date.now(),
      name: "Option",
      value: "0",
      image: null,
    };
    onUpdateOptions([...options, newOption]);
  };

  const updateOption = (id, field, value) => {
    onUpdateOptions(options.map((opt) => (opt.id === id ? { ...opt, [field]: value } : opt)));
  };

  const deleteOption = (id) => {
    onUpdateOptions(options.filter((opt) => opt.id !== id));
  };

  const addValueRange = () => {
    const newRange = { id: Date.now(), start: "0", end: "0", value: "0" };
    onUpdateValueRanges([...valueRanges, newRange]);
  };

  const updateValueRange = (id, field, value) => {
    onUpdateValueRanges(valueRanges.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const deleteValueRange = (id) => {
    onUpdateValueRanges(valueRanges.filter((r) => r.id !== id));
  };

  // get available image selector elements for conditional display
  const imageSelectorElements = allComponents
    .map((comp, idx) => ({ ...comp, index: idx }))
    .filter((comp) => comp.type === "image_selector" && comp.index !== currentIndex);

  // Common sections that appear for ALL elements
  const renderCommonSections = () => (
    <>
      {/* label */}
      <div style={propertyStyles.sectionWhite}>
        <label style={propertyStyles.label}>Label</label>
        <input
          type="text"
          value={label || ""}
          onChange={(e) => onUpdateLabel(e.target.value)}
          style={propertyStyles.input}
          placeholder="Enter label"
        />
      </div>

      {/* placeholder and required */}
      {["dropdown", "radio", "text_input", "number_input", "image_selector", "heading"].includes(type) && (
        <div style={propertyStyles.sectionWhite}>
          <label style={propertyStyles.label}>Placeholder</label>
          <input
            type="text"
            value={placeholder || ""}
            onChange={(e) => onUpdatePlaceholder(e.target.value)}
            style={propertyStyles.input}
            placeholder="Enter placeholder text"
          />
          <label style={{ ...propertyStyles.checkboxLabel, marginTop: 8 }}>
            <input type="checkbox" checked={!!required} onChange={(e) => onUpdateRequired(e.target.checked)} />
            <span>Required</span>
          </label>
        </div>
      )}
    </>
  );

  const renderTooltipSection = () => (
    <div style={propertyStyles.sectionWhite}>
      <label style={propertyStyles.checkboxLabel}>
        <input type="checkbox" checked={tooltip?.enabled || false} 
        onChange={(e) => onUpdateTooltip({ ...tooltip, enabled: e.target.checked })} />
        <span>Enable Tooltip</span>
      </label>
      {tooltip?.enabled && (
        <>
          <input
            type="text"
            value={tooltip.text || ""}
            onChange={(e) => onUpdateTooltip({ ...tooltip, text: e.target.value })}
            style={{ ...propertyStyles.input, marginTop: 8 }}
            placeholder="Enter tooltip text"
          />
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
            Shows a "?" icon with helpful information on hover
          </div>
        </>
      )}
    </div>
  );

  const renderConditionalDisplaySection = () => {
  if (allComponents.length <= 1) return null;

  //get all valid trigger elements(exclude current element and non-interactive elements
  const validTriggerElements = allComponents
    .map((comp, idx) => ({ ...comp, index: idx, position: idx + 1 }))
    .filter((comp) => 
      comp.index !== currentIndex && 
      ![
        "heading", 
        "text_block", 
        "calculation_display", 
        "file_upload", 
        "photo_editor"
      ].includes(comp.type)
    );

  const cd = conditionalDisplay || {
    enabled: false,
    valueWhenNotDisplayed: "1",
    triggerElementId: null,
    operator: "exists",
    value: "",
    rules: [],
    match: "all",
    usePosition: true  // position over ID
  };

  //find selected trigger element to determine its type
  const selectedTrigger = validTriggerElements.find(el => {
    // Check both position and ID
    if (cd.usePosition && cd.triggerElementId) {
      const posMatch = cd.triggerElementId.match(/^element_(\d+)$/);
      if (posMatch) {
        return el.position === parseInt(posMatch[1]);
      }
    }
    return el.id === cd.triggerElementId;
  });

  //helper to get conditions based on element type
  const getConditions = (elementType) => {
    switch(elementType){
      case 'dropdown':
      case 'radio':
      case 'image_selector':
        return [
          { value: 'exists', label: '✓ has any option selected' },
          { value: 'not_exists', label: '✗ has no option selected' },
          { value: '==', label: '= equals (specific option)' },
          { value: '!=', label: '≠ does not equal' }
        ];
      
      case 'number_input':
        return [
          { value: 'exists', label: '✓ has any value entered' },
          { value: 'not_exists', label: '✗ is empty' },
          { value: '==', label: '= equals exactly' },
          { value: '!=', label: '≠ does not equal' },
          { value: '>', label: '> is more than' },
          { value: '>=', label: '≥ is at least' },
          { value: '<', label: '< is less than' },
          { value: '<=', label: '≤ is at most' }
        ];

      case "checkbox":
        return [
          { value: 'exists', label: '✓ is checked' },
          { value: 'not_exists', label: '✗ is not checked' },
          { value: 'contains', label: '⊃ includes option' },
          { value: 'not_contains', label: '⊅ does not include' }
        ];

      case "text_input": 
        return [
          { value: 'exists', label: '✓ has any text' },
          { value: 'not_exists', label: '✗ is empty' },
          { value: '==', label: '= equals exactly' },
          { value: '!=', label: '≠ does not equal' },
          { value: 'contains', label: '⊃ contains text' },
          { value: 'not_contains', label: '⊅ does not contain' }
        ];

      default:
        return [
          { value: 'exists', label: '✓ has any value' },
          { value: 'not_exists', label: '✗ is empty' },
          { value: '==', label: '= equals' },
          { value: '!=', label: '≠ does not equal' }
        ];
    }
  };

  //helper to check if value input is needed
  const needsValueInput = (operator) => {
    return !['exists', 'not_exists'].includes(operator);
  };

  // Simple mode: single trigger
  const isSimpleMode = !cd.rules || cd.rules.length === 0;

  const addRule = () => {
    const newRules = cd.rules || [];
    onUpdateConditionalDisplay({
      ...cd,
      rules: [
        ...newRules,
        { triggerElementId: "", operator: "exists", value: "" }
      ]
    });
  };

  //update rule
  const updateRule = (index, field, value) => {
    const newRules = [...(cd.rules || [])];
    newRules[index] = { ...newRules[index], [field]: value };
    onUpdateConditionalDisplay({ ...cd, rules: newRules });
  };

  const deleteRule = (index) => {
    const newRules = (cd.rules || []).filter((_, i) => i !== index);
    onUpdateConditionalDisplay({ ...cd, rules: newRules });
  };

  const switchToAdvanced = () => {
    const newRule = {
      triggerElementId: cd.triggerElementId || "",
      operator: cd.operator || "exists",
      value: cd.value || ""
    };
    onUpdateConditionalDisplay({
      ...cd,
      rules: [newRule],
      triggerElementId: null
    });
  };

  const switchToSimple = () => {
    const firstRule = cd.rules?.[0];
    onUpdateConditionalDisplay({
      ...cd,
      triggerElementId: firstRule?.triggerElementId || null,
      operator: firstRule?.operator || "exists",
      value: firstRule?.value || "",
      rules: []
    });
  };

  return (
    <div style={{
      ...propertyStyles.sectionWhite, 
      background: "#fef3c7", 
      borderColor: "#fcd34d"
    }}>
      {/*header*/}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <label style={{ ...propertyStyles.label, marginBottom: 0 }}>
            Conditional Display
          </label>
        </div>

        {cd.enabled && validTriggerElements.length > 0 && (
          <button 
            onClick={isSimpleMode ? switchToAdvanced : switchToSimple}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              borderRadius: 4,
              border: "1px solid #92400e",
              background: "#fef3c7",
              color: "#92400e",
              cursor: "pointer",
              fontWeight: 500
            }}>
            {isSimpleMode ? "⚙️ Advanced" : "⬅️ Simple"}
          </button>
        )}
      </div>

      {/*enable toggle*/}
      <label style={propertyStyles.checkboxLabel}>
        <input 
          type="checkbox" 
          checked={cd.enabled} 
          onChange={(e) => onUpdateConditionalDisplay({ 
            ...cd, 
            enabled: e.target.checked 
          })} 
        />
        <span>Enable Conditional Display</span>
      </label>

      {cd.enabled && (
        <>
          {/*value when hidden*/}
          <div style={{ marginTop: 12}}>
            <label style={propertyStyles.labelSmall}>
              Value when hidden
            </label>
            <input
              type="number"
              value={cd.valueWhenNotDisplayed || "1"}
              onChange={(e) => onUpdateConditionalDisplay({
                ...cd,
                valueWhenNotDisplayed: e.target.value
              })}
              style={propertyStyles.input}
              placeholder="1"
            />
            <div style={{ fontSize: 11, color: "#854d0e", marginTop: 4 }}>
              Value used in formulas when this element is hidden
            </div>
          </div>

          {/*Reference Type Toggle */}
          <div style={{ marginTop: 12, padding: 10, background: "#fffbeb", borderRadius: 6, border: "1px solid #fcd34d" }}>
            <label style={propertyStyles.checkboxLabel}>
              <input
                type="checkbox"
                checked={cd.usePosition !== false}
                onChange={(e) => onUpdateConditionalDisplay({
                  ...cd,
                  usePosition: e.target.checked
                })}
              />
              <span>Use Position Referencee</span>
            </label>
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 4, marginLeft: 24 }}>
              {cd.usePosition !== false 
                ? "Using element_1, element_2, etc, better than element ids"
                : "Using element IDs"}
            </div>
          </div>

          {validTriggerElements.length === 0 ? (
            <div style={{
              marginTop: 12,
              padding: 10,
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              fontSize: 12,
              color: "#991b1b"
            }}>
              ⚠️ No valid trigger elements available. Add interactive elements 
              (dropdown, number input, checkbox, etc.) first.
            </div>
          ) : ( 
            <>
              {/*simple mode*/}
              {isSimpleMode ? (
                <>
                  <div style={{ marginTop: 12}}>
                    <label style={propertyStyles.labelSmall}>
                      Trigger Element
                    </label>
                    <select
                      value={cd.triggerElementId || ""}
                      onChange={(e) => {
                        const selectedEl = validTriggerElements.find(el => 
                          cd.usePosition !== false 
                            ? `element_${el.position}` === e.target.value
                            : el.id === e.target.value
                        );
                        
                        onUpdateConditionalDisplay({
                          ...cd,
                          triggerElementId: e.target.value,
                          operator: "exists"
                        });
                      }}
                      style={propertyStyles.input}
                    >
                      <option value="">Select Element</option>
                      {validTriggerElements.map((el) => {
                        const value = cd.usePosition !== false ? `element_${el.position}` : el.id;
                        const display = cd.usePosition !== false 
                          ? `Element ${el.position}: ${el.label || el.type}`
                          : el.label || `${el.type} ${el.index + 1}`;
                        
                        return (
                          <option key={el.id} value={value}>
                            {display}
                          </option>
                        );
                      })}
                    </select>
                    {cd.usePosition !== false && cd.triggerElementId && (
                      <div style={{ fontSize: 10, color: "#059669", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <span>✓</span>
                        <span>Using position reference: {cd.triggerElementId}</span>
                      </div>
                    )}
                  </div>

                  {cd.triggerElementId && (
                    <>
                      <div style={{ marginTop: 12}}>
                        <label style={propertyStyles.labelSmall}>
                          Condition (When to show this field)
                        </label>
                        <select
                          value={cd.operator || "exists"}
                          onChange={(e) => onUpdateConditionalDisplay({
                            ...cd,
                            operator: e.target.value
                          })}  
                          style={propertyStyles.input}
                        >
                          {getConditions(selectedTrigger?.type).map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {needsValueInput(cd.operator || "exists") && (
                        <div style={{ marginTop: 12}}>
                          <label style={propertyStyles.labelSmall}>
                            Compare Value
                          </label>
                          <input
                            type="text"
                            value={cd.value || "" }
                            onChange={(e) => onUpdateConditionalDisplay({
                              ...cd,
                              value: e.target.value
                            })}
                            style={propertyStyles.input}
                            placeholder="Enter value to compare"
                          />
                          <div style={{ fontSize: 11, color: "#854d0e", marginTop: 4 }}>
                            💡 For dropdowns/radios: enter the option value or ID
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/*preview box*/}
                  {cd.triggerElementId && (
                    <div style={{
                      marginTop: 12,
                      padding: 10,
                      background: "#f0fdf4",
                      border: "1px solid #86efac",
                      borderRadius: 6,
                      fontSize: 12
                    }}>
                      <strong>✓ Preview:</strong>
                      <div style={{ marginTop: 4, color: "#166534"}}>
                        This field will <strong>show</strong> when{' '}
                        <strong>"{selectedTrigger?.label || cd.triggerElementId}"</strong>{' '}
                        <strong>{getConditions(selectedTrigger?.type).find(o => o.value === (cd.operator || 'exists'))?.label.replace(/^[✓✗=≠><≥≤⊃⊅]\s*/, '')}</strong>
                        {cd.value && <React.Fragment> <strong>"{cd.value}"</strong></React.Fragment>}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Advanced mode
                <>
                  <div style={{ marginTop: 12}}>
                    <label style={propertyStyles.labelSmall}>
                      Match Type
                    </label>
                    <select
                      value={cd.match || "all"}
                      onChange={(e) => onUpdateConditionalDisplay({
                        ...cd,
                        match: e.target.value
                      })}
                      style={propertyStyles.input}
                    >
                      <option value="all">Match ALL conditions (AND)</option>
                      <option value="any">Match ANY condition (OR)</option>
                    </select>
                  </div>

                  <div style={{ marginTop: 12}}>
                    <div style={{
                      display: "flex", 
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8
                    }}>
                      <label style={{
                        ...propertyStyles.labelSmall,
                        marginBottom: 0
                      }}>
                        Conditions ({cd.rules?.length || 0})
                      </label>
                      <button
                        onClick={addRule}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: 4,
                          border: "none",
                          background: "#10b981",
                          color: "#fff",
                          cursor: "pointer",
                          fontWeight: 500
                        }}
                      >
                        + Add Condition
                      </button>
                    </div>

                    {(!cd.rules || cd.rules.length === 0) ? (
                      <div style={{
                        padding: 12,
                        background: "#fef3c7",
                        border: "1px dashed #fcd34d",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#92400e",
                        textAlign: "center"
                      }}>
                        No conditions yet. Click "+ Add" to create one.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {cd.rules.map((rule, index) => {
                          const ruleElement = validTriggerElements.find(el => {
                            if (cd.usePosition !== false) {
                              const posMatch = rule.triggerElementId?.match(/^element_(\d+)$/);
                              return posMatch && el.position === parseInt(posMatch[1]);
                            }
                            return el.id === rule.triggerElementId;
                          });
                          
                          return (
                            <div key={index}
                              style={{
                                padding: 10,
                                background: "#fff",
                                border: "1px solid #fcd34d",
                                borderRadius: 6
                              }}
                            >
                              <label style={{ ...propertyStyles.labelSmall, fontSize: 10 }}>
                                Trigger Element
                              </label>
                              <select
                                value={rule.triggerElementId || ""}
                                onChange={(e) => updateRule(index, "triggerElementId", e.target.value)}
                                style={{ ...propertyStyles.input, marginBottom: 6 }}
                              >
                                <option value="">Select Element</option>
                                {validTriggerElements.map((el) => {
                                  const value = cd.usePosition !== false ? `element_${el.position}` : el.id;
                                  const display = cd.usePosition !== false 
                                    ? `Element ${el.position}: ${el.label || el.type}`
                                    : el.label || `${el.type} ${el.index + 1}`;
                                  
                                  return (
                                    <option key={el.id} value={value}>
                                      {display}
                                    </option>
                                  );
                                })}
                              </select>
                              
                              <label style={{ ...propertyStyles.labelSmall, fontSize: 10}}>
                                Condition
                              </label>
                              <select
                                value={rule.operator || "exists"}
                                onChange={(e) => updateRule(index, "operator", e.target.value)}
                                style={{...propertyStyles.input, marginBottom: 6}}
                              >
                                {getConditions(ruleElement?.type).map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>

                              {needsValueInput(rule.operator || "exists") && (
                                <>
                                  <label style={{...propertyStyles.labelSmall, fontSize: 10}}>
                                    Compare Value
                                  </label>
                                  <input
                                    type="text"
                                    value={rule.value || ""}
                                    onChange={(e) => updateRule(index, "value", e.target.value)}
                                    placeholder="Enter value"
                                    style={{...propertyStyles.input, marginBottom: 6}}
                                  />
                                </>
                              )}

                              <button
                                onClick={()=>deleteRule(index)}
                                style={{
                                  width: "100%",
                                  padding: "6px",
                                  fontSize: 11,
                                  borderRadius: 4,
                                  border: "none",
                                  background: "#fee2e2",
                                  color: "#991b1b",
                                  cursor: "pointer",
                                  fontWeight: 500
                                }}
                              >
                                🗑️ Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/*info box*/}
      <div style={{
        marginTop: 12, 
        padding: 10, 
        background: "#fef9c3", 
        borderRadius: 4, 
        fontSize: 11, 
        color: "#854d0e"
      }}>
        <strong>💡 How it works:</strong>
        <br/>
        {isSimpleMode ? (
          <>This element will only be visible when the condition is met.</>
        ) : (
          <>This element will be visible when <strong>{cd.match === "all" ? "ALL" : "ANY"}</strong> conditions are met.</>
        )}
      </div>
    </div>
  );
};

  const renderAdditionalInfoSection = () => (
    <div style={propertyStyles.additionalInfo}>
      <strong style={{ display: "block", marginBottom: 8, fontSize: 13 }}>ℹ️ Element Information</strong>
      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
        {additionalInfo || "No additional information available for this element."}
      </div>
    </div>
  );

  return (
    // main properties container
    <div style={{ overflowY: "auto", height: "100%", padding: 8 }}>
      {renderCommonSections()}

      {/* element specific properties */}

      {type === "dropdown" && (
        <div style={propertyStyles.sectionBlue}>
          <label style={propertyStyles.label}>Options</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt) => (
              <div key={opt.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 40px", gap: 8, alignItems: "center" }}>
                <input 
                  type="text" 
                  value={opt.name} 
                  onChange={(e) => updateOption(opt.id, "name", e.target.value)} 
                  style={propertyStyles.inputSmall} placeholder="Option name" />
                <input type="number" value={opt.value} onChange={(e) => updateOption(opt.id, "value", e.target.value)} 
                style={propertyStyles.inputSmall} placeholder="Value" />
                <button onClick={() => deleteOption(opt.id)} disabled={options.length <= 1} 
                style={propertyStyles.deleteBtn} title="Delete option">
                🗑️
                </button>
              </div>
            ))}
            <button onClick={addOption} style={propertyStyles.addMoreBtn}>+ Add More Options</button>
          </div>

          <TypographyControls
            compStyles={compStyles}
            onUpdateStyle={onUpdateStyle}
            showAlignment={false}
            showColors={true}
            showSpacing={false}
            fontSizeRange={{ min: 12, max: 20 }}
            labelPrefix="Dropdown "
          />

          {renderConditionalDisplaySection()}
          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </div>
      )}

      {type === "radio" && (
        <div style={propertyStyles.sectionBlue}>
          <label style={propertyStyles.label}>Radio Options</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt) => (
              <div 
                key={opt.id} 
                style={{ display: "grid", gridTemplateColumns: "1fr 80px 40px", gap: 8, alignItems: "center" }}>
                <input 
                  type="text" 
                  value={opt.name}  
                  onChange={(e) => updateOption(opt.id, "name", e.target.value)} 
                  style={propertyStyles.inputSmall} 
                  placeholder="Option name" />
                <input 
                  type="number" 
                  value={opt.value} 
                  onChange={(e) => updateOption(opt.id, "value", e.target.value)} 
                  style={propertyStyles.inputSmall} 
                  placeholder="Value" />
                <button 
                  onClick={() => deleteOption(opt.id)} 
                  disabled={options.length <= 1} 
                  style={propertyStyles.deleteBtn} 
                  title="Delete option">
                    🗑️
                  </button>
              </div>
            ))}
            <button 
              onClick={addOption} 
              style={propertyStyles.addMoreBtn}>
                + Add More Options
            </button>
          </div>

          <TypographyControls
            compStyles={compStyles}
            onUpdateStyle={onUpdateStyle}
            showAlignment={false}
            showColors={true}
            showSpacing={false}
            fontSizeRange={{ min: 12, max: 32 }}
            labelPrefix="Radio "
          />

          {renderConditionalDisplaySection()}
          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </div>
      )}

      {type === "image_selector" && (
        <>
          <div style={propertyStyles.sectionBlue}>
            <label style={propertyStyles.label}>Image Swatch Options</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {options.map((opt) => (
                <div key={opt.id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 40px", gap: 8, alignItems: "center" }}>
                  <input type="text" value={opt.name} onChange={(e) => updateOption(opt.id, "name", e.target.value)} style={propertyStyles.inputSmall} placeholder="Option name" />
                  <input type="number" value={opt.value} onChange={(e) => updateOption(opt.id, "value", e.target.value)} style={propertyStyles.inputSmall} placeholder="Value" />
                  <label style={{ ...propertyStyles.uploadBtn, cursor: "pointer", textAlign: "center", display: "block" }}>
                    📤 Upload
                    <input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => updateOption(opt.id, "image", reader.result);
                        reader.readAsDataURL(file);
                      }
                    }} style={{ display: "none" }} />
                  </label>
                  <button onClick={() => deleteOption(opt.id)} disabled={options.length <= 1} style={propertyStyles.deleteBtn} title="Delete option">🗑️</button>
                </div>
              ))}
              <button onClick={addOption} style={propertyStyles.addMoreBtn}>+ Add More Options</button>
            </div>
          </div>

          <div style={propertyStyles.sectionWhite}>
            <label style={propertyStyles.label}>Display Settings</label>
            <label style={propertyStyles.checkboxLabel}>
              <input type="checkbox" checked={settings?.enableSwatch || false} onChange={(e) => onUpdateSettings({ ...(settings || {}), enableSwatch: e.target.checked })} />
              <span>Enable Swatch (show images instead of dropdown)</span>
            </label>
            <label style={{ ...propertyStyles.checkboxLabel, marginTop: 8 }}>
              <input type="checkbox" checked={settings?.showImageOnSelection || false} onChange={(e) => onUpdateSettings({ ...(settings || {}), showImageOnSelection: e.target.checked })} />
              <span>Show Selected Image on Product</span>
            </label>
          </div>

          {renderConditionalDisplaySection()}
          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </>
      )}

      {type === "text_block" && (
        <>
          <div style={propertyStyles.sectionBlue}>
            <label style={propertyStyles.label}>Heading</label>
            <input type="text" value={content?.heading || ""} onChange={(e) => onUpdateContent({ ...(content || {}), heading: e.target.value })} style={propertyStyles.input} placeholder="Enter heading" />
          </div>

          <div style={propertyStyles.sectionWhite}>
            <label style={propertyStyles.label}>Content</label>
            <textarea 
              value={content?.richText || ""} 
              onChange={(e) => onUpdateContent({ ...(content || {}), richText: e.target.value })} 
              placeholder="Enter text content here..." 
              style={{ width: "100%", minHeight: 120, padding: 12, boxSizing: "border-box", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }} />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Line breaks will be preserved in the output</div>

            <TypographyControls
              compStyles={compStyles}
              onUpdateStyle={onUpdateStyle}
              showAlignment={true}
              showColors={true}
              showSpacing={true}
              fontSizeRange={{ min: 12, max: 32 }}
              labelPrefix="Text Block"
            />
    
            {renderConditionalDisplaySection()}
            {renderTooltipSection()}
            {renderAdditionalInfoSection()}
          </div>
        </>
      )}

      {type === "text_input" && (
        <div style={propertyStyles.sectionBlue}>
          <label style={propertyStyles.label}>Text Input Settings</label>

          <label style={propertyStyles.checkboxLabel}>
            <input type="checkbox" checked={settings?.includeSpaceInLength || false} onChange={(e) => onUpdateSettings({ ...(settings || {}), includeSpaceInLength: e.target.checked })} />
            <span>Include Spaces in Character Count</span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <div>
              <label style={propertyStyles.labelSmall}>Min Characters</label>
              <input type="number" value={settings?.minCharacters || "0"} onChange={(e) => onUpdateSettings({ ...(settings || {}), minCharacters: e.target.value })} style={propertyStyles.inputSmall} placeholder="0" />
            </div>
            <div>
              <label style={propertyStyles.labelSmall}>Max Characters</label>
              <input type="number" value={settings?.maxCharacters || "50"} onChange={(e) => onUpdateSettings({ ...(settings || {}), maxCharacters: e.target.value })} style={propertyStyles.inputSmall} placeholder="50" />
            </div>
          </div>

          <TypographyControls
            compStyles={compStyles}
            onUpdateStyle={onUpdateStyle}
            showAlignment={false}
            showColors={true}
            showSpacing={false}
            fontSizeRange={{ min: 12, max: 18 }}
            labelPrefix="Input"
          />
          {renderConditionalDisplaySection()}
          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </div>
      )}

      {type === "checkbox" && (
        <>
        <div style={propertyStyles.sectionBlue}>
          <label style={propertyStyles.label}>Checkbox</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12}}>
            <button
              onClick={() => onUpdateSettings({
                ...settings,
                multipleSelection: false,
                unCheckedValue: settings?.unCheckedValue || "0",
                checkedValue: settings?.checkedValue || "10"
              })}

              style={{
                flex: 1,
                padding: "8px 12px",
                background: !settings?.multipleSelection ? "#3b82f6" : "#fff",
                color: !settings?.multipleSelection ? "#fff" : "#374151",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              Single Selection
            </button>
            <button
            onClick={()=>onUpdateSettings({
              ...settings,
              multipleSelection: true
            })}
            style={{
              flex: 1,
              padding: "8px 12px",
              background: settings?.multipleSelection ? "#3b82f6" : "#fff",
              color: settings?.multipleSelection ? "#fff" : "#374151",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 13,
            }}
            >
              Multiple Selection
            </button>
          </div>

          {!settings?.multipleSelection && (
            <div style={{ padding: 12, background: "#f0f9ff", borderRadius: 6, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 12 }}>
                💡 Single checkbox with custom values
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={propertyStyles.labelSmall}>Unchecked Value</label>
                  <input
                  type="number"
                  value={settings?.unCheckedValue || "0" }
                  onChange={(e) => onUpdateSettings({...settings, unCheckedValue: e.target.value})}
                  style={propertyStyles.inputSmall}
                  placeholder="0"
                  />
                </div>
                <div>
                  <label style={propertyStyles.labelSmall}>Checked Value</label>
                  <input
                  type="number"
                  value={settings?.checkedValue || "10"}
                  onChange={(e)=>onUpdateSettings({...settings, checkedValue:e.target.value})}
                  style={propertyStyles.inputSmall}
                  placeholder="10"
                  />
                </div>
              </div>
            </div>
          )}


          {settings?.multipleSelection && (
            <div style={{ padding: 12, background: "#f0fdf4", borderRadius: 6, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#065f46", marginBottom: 12 }}>
                💡 Multiple checkboxes - each can be selected independently
              </div>

              <label style={propertyStyles.label}>Checkbox Options</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {options.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 80px 40px",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => updateOption(opt.id, "name", e.target.value)}
                      style={propertyStyles.inputSmall}
                      placeholder="Option Name"
                    />
                    <input
                    type="number"
                    value={opt.value}
                    onChange={(e) => updateOption(opt.id, "value", e.target.value)}
                    style={propertyStyles.inputSmall}
                    placeholder="Value"
                    />
                    <button
                    onClick={()=>deleteOption(opt.id)}
                    disabled={options.length <= 1 }
                    style={propertyStyles.deleteBtn}
                    title="Delete Option"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                <button onClick={addOption} style={propertyStyles.addMoreBtn}>
                  + Add more option
                </button>
              </div>
            </div>
          )}

          <label style={{...propertyStyles.checkboxLabel, marginTop:12}}>
            <input
            type="checkbox"
            checked={settings?.required || false }
            onChange={(e) => onUpdateSettings({...settings, required: e.target.checked})}
            />
            <span>Required</span>
          </label>
        </div>

        <TypographyControls
        compStyles={compStyles}
        onUpdateStyle={onUpdateStyle}
        showAlignment={false}
        showColors={true}
        showSpacing={false}
        fontSizeRange={{ min: 12, max: 24}}
        labelPrefix="Checkbox "
        />

        {renderConditionalDisplaySection()}
        {renderTooltipSection()}
        {renderAdditionalInfoSection()}
        </>
      )}

      {type === "number_input" && (
        <>
          <div style={propertyStyles.sectionBlue}>
            <label style={propertyStyles.label}>
              Number Input Settings
            </label>

            <label style={propertyStyles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings?.useAsQuantity || false}
                onChange={(e) => onUpdateSettings({...(settings || {}), useAsQuantity: e.target.checked})}
              />
              <span>Use as Quantity(Product Cart Quantity)</span>
            </label>

            {!settings?.useAsQuantity && (
              <>
                <label style={{...propertyStyles.labelSmall, marginTop: 8}}>Max Decimal Places</label>
                <input
                  type="range"
                  min='0'
                  max='10'
                  value={settings?.maxDecimal || 0}
                  onChange={(e) => onUpdateSettings({ ...(settings || {}), maxDecimal:parseInt(e.target.value, 10) })}
                  style={{ width: "100%"}}
                />
                <div style={{ fontSize: 12, color: '#6b7280'}}>
                  Current: {settings?.maxDecimal || 0}
                </div>
              </>
            )}

            {/* Default Value Field */}
            <div style={{ marginTop: 12 }}>
              <label style={propertyStyles.labelSmall}>Default Value</label>
              <input 
                type="number" 
                value={settings?.defaultValue || ""} 
                onChange={(e) => onUpdateSettings({ 
                  ...(settings || {}), 
                  defaultValue: e.target.value 
                })} 
                style={propertyStyles.inputSmall} 
                placeholder="e.g., 25 for base price" 
              />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Pre-filled value when form loads. Perfect for base prices or hidden calculations.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8}}>
              <div>
                <label style={propertyStyles.labelSmall}>Minimum Value</label>
                <input 
                  type="number" 
                  value={settings?.minValue || "0"} 
                  onChange={(e) => onUpdateSettings({ ...(settings || {}), minValue: e.target.value })} 
                  style={propertyStyles.inputSmall} 
                  placeholder="0" 
                />
              </div>
              <div>
                <label style={propertyStyles.labelSmall}>Maximum Value</label>
                <input 
                  type="number" 
                  value={settings?.maxValue || "10000"} 
                  onChange={(e) => onUpdateSettings({ ...(settings || {}), maxValue: e.target.value })} 
                  style={propertyStyles.inputSmall} 
                  placeholder="10000" 
                />
              </div>
            </div>
          </div>

          <div style={propertyStyles.sectionWhite}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ ...propertyStyles.label, marginBottom: 0 }}>
                Value Ranges (Bulk Pricing)
              </label>

              <button
                onClick={() => onUpdateSettings({
                  ...(settings || {}),
                  valueRangeEnabled: !settings?.valueRangeEnabled
                })}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: settings?.valueRangeEnabled ? "#10b981" : "#d1d5db",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {settings?.valueRangeEnabled?"✓ Enabled" : "○ Disabled"}
              </button>
            </div>

            <div style={{
              fontSize: 11, 
              color: "#6b7280", 
              marginBottom: 12,
              padding: 10,
              background: "#f0f9ff",
              borderRadius: 6,
              border: "1px solid #bae6fd",
            }}>
              <strong>What are Value Ranges?</strong>
              <br />
              Define different values based on input ranges. Perfect for bulk pricing (e.g., 1-10 units = $10/each, 11-50 units = $8/each).
            </div>

            {settings?.valueRangeEnabled? (
              <>
                {/* Value range inputs */}
            {(valueRanges && valueRanges.length > 0) ? valueRanges.map((r, index) => (
              <div
                key={r.id}
                style={{
                  display: "grid", 
                  gridTemplateColumns: "1fr 1fr 1fr 40px", 
                  gap: 8, 
                  alignItems: "center", 
                  marginBottom: 8,
                  padding: 8,
                  background: index % 2 === 0 ? "#f9fafb" : "#fff",
                  borderRadius: 4,
                  border: "1px solid #e5e7eb",
                }}
              >
                <input 
                  type="number" 
                  value={r.start} 
                  onChange={(e) => updateValueRange(r.id, "start", e.target.value)} 
                  style={propertyStyles.inputSmall} 
                  placeholder="Start" 
                />
                <input 
                  type="number" 
                  value={r.end} 
                  onChange={(e) => updateValueRange(r.id, "end", e.target.value)} 
                  style={propertyStyles.inputSmall} 
                  placeholder="End" 
                />
                <input 
                  type="number" 
                  value={r.value} 
                  onChange={(e) => updateValueRange(r.id, "value", e.target.value)} 
                  style={propertyStyles.inputSmall} 
                  placeholder="Value" 
                />
                <button 
                  onClick={() => deleteValueRange(r.id)} 
                  disabled={valueRanges.length <= 1} 
                  style={{
                    ...propertyStyles.deleteBtn,
                    opacity: valueRanges.length <= 1 ? 0.5 : 1,
                    cursor: valueRanges.length <= 1 ? 'not-allowed' : 'pointer'
                  }} 
                  title="Delete range"
                >
                  🗑️
                </button>
              </div>
            )) : (
              <div style={{
                padding: 12,
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: 6,
                fontSize: 12,
                color: "#92400e",
                textAlign: "center",
                marginBottom: 12
              }}>
                No value ranges configured yet. Click "Add Value Range" to start.
              </div>
            )}
            
            <button
              onClick={addValueRange}
              style={propertyStyles.addMoreBtn}
            >
              + Add Value Range
            </button>

            {/* Example Usage */}
            {valueRanges && valueRanges.length > 0 && (
              <div style={{ 
                marginTop: 12,
                padding: 10,
                background: "#ecfdf5",
                border: "1px solid #6ee7b7",
                borderRadius: 6,
                fontSize: 11,
                color: "#065f46",
              }}>
                <strong>📊 Current Ranges:</strong>
                <div style={{ marginTop: 6 }}>
                  {valueRanges.map((r, idx) => (
                    <div key={r.id} style={{ marginBottom: 2 }}>
                      • {r.start} to {r.end}: value = <strong>{r.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
              </>
            ): (
              <div style={{ 
                padding: 16,
                background: "#f9fafb",
                border: "2px dashed #d1d5db",
                borderRadius: 6,
                textAlign: "center",
                color: "#6b7280",
                fontSize: 12,
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
                <div>Value ranges are currently disabled</div>
                <div style={{ marginTop: 4, fontSize: 11 }}>
                  Enable to set up bulk pricing or tiered values
                </div>
              </div>
            )}
          </div>

          {renderConditionalDisplaySection()}
          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </>
      )}

      {/* Hide Element Section */}
      <div style={propertyStyles.sectionWhite}>
        <label style={propertyStyles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings?.hidden || false}
            onChange={(e) => onUpdateSettings({
              ...(settings || {}), 
              hidden: e.target.checked
            })}
          />
          <span>Hide this element from customers</span>
        </label>
        <div style={{ 
          fontSize: 11, 
          color: '#6b7280', 
          marginTop: 6, 
          marginLeft: 20,
          padding: 8,
          background: '#fef3c7',
          borderRadius: 4,
          border: '1px solid #fcd34d'
        }}>
          💡 <strong>Use case:</strong> Hidden elements can still be used in calculations 
          (e.g., base price = 25) but won't be visible to customers.
        </div>
      </div>

      {type === "calculation_display" && (
        <>
          <div style={propertyStyles.sectionBlue}>
            <label style={propertyStyles.label}>Formula</label>
            <FormulaInput
              value={settings?.formula || ""}
              onChange={(newValue) => onUpdateSettings({ ...(settings || {}), formula: newValue })}
              components={components}
              placeholder="e.g., {Size} * {Color} + 10"
              multiline={false}
              showConversion={false}
            />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              Use {'{Field Name}'} to reference elements. Type {'{'}  to see autocomplete.
            </div>
          </div>

          <div style={propertyStyles.sectionWhite}>
            <label style={propertyStyles.label}>Display Settings</label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={propertyStyles.labelSmall}>Prefix</label>
                <input type="text" value={settings?.formulaPrefix || ""} onChange={(e) => onUpdateSettings({ ...(settings || {}), formulaPrefix: e.target.value })} style={propertyStyles.inputSmall} placeholder="e.g., $" />
              </div>
              <div>
                <label style={propertyStyles.labelSmall}>Suffix</label>
                <input type="text" value={settings?.formulaSuffix || ""} onChange={(e) => onUpdateSettings({ ...(settings || {}), formulaSuffix: e.target.value })} style={propertyStyles.inputSmall} placeholder="e.g., USD" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label style={propertyStyles.labelSmall}>Min Value</label>
                <input type="number" value={settings?.minValue || "0"} onChange={(e) => onUpdateSettings({ ...(settings || {}), minValue: e.target.value })} style={propertyStyles.inputSmall} placeholder="0" />
              </div>
              <div>
                <label style={propertyStyles.labelSmall}>Decimal Places</label>
                <input type="number" min="0" max="10" value={settings?.formulaDecimal || 0} onChange={(e) => onUpdateSettings({ ...(settings || {}), formulaDecimal: parseInt(e.target.value, 10) })} style={propertyStyles.inputSmall} placeholder="2" />
              </div>
            </div>

            <label style={{ ...propertyStyles.checkboxLabel, marginTop: 8 }}>
              <input type="checkbox" checked={settings?.useAsQuantity || false} onChange={(e) => onUpdateSettings({ ...(settings || {}), useAsQuantity: e.target.checked })} />
              <span>Use Calculation Result as Product Quantity</span>
            </label>
          </div>
          {renderConditionalDisplaySection()}
          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </>
      )}

      {/* data lookup */}
      {type === "data_lookup" && (
        <>
          <DataLookupPropertiesPanel
            tableData={tableData}
            settings={settings}
            onUpdateTableData={onUpdateTableData}
            onUpdateSettings={onUpdateSettings}
          />
          {renderConditionalDisplaySection()}
          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </>
)}

      {type === "heading" && (
        <>
          {/* Heading Text */}
          <div style={propertyStyles.sectionWhite}>
            <label style={propertyStyles.label}>Heading Text</label>
            <input 
              type="text" 
              value={content?.text || ""} 
              onChange={(e) => onUpdateContent({ ...(content || {}), text: e.target.value })} 
              style={propertyStyles.input} 
              placeholder="Enter heading text" 
            />
          </div>

          {/*typography component*/}
          <TypographyControls
          compStyles={compStyles}
          onUpdateStyle={onUpdateStyle}
          showAlignment={true}
          showColors={true}
          showSpacing={true}
          fontSizeRange={{ min: 12, max: 96}}
          labelPrefix=""
          />

          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </>
      )}

     
    </div>
  );
}


// ==================== render component ====================
function RenderComponent({ component = {}, preview = false }) {
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
    valueRanges = [], 
    tableData = null 
  } = component;

  const [uploadedFile, setUploadedFile] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [editedPhoto, setEditedPhoto] = useState(null);

  const renderTooltip = () => {
    if (tooltip?.enabled && tooltip?.text) {
      return <span title={tooltip.text} style={{ marginLeft: 6, fontWeight: 700, cursor: "help" }}>?</span>;
    }
    return null;
  };

  //helper to apply typography styles to labels
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

  //helper for input/select field styles
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
  });


  const renderLabel = (text, showRequired = true) => (
    <label style={getLabelStyles()}>
      {text}
      {showRequired && required && 
        <span style={{ color: "#dc2626", marginLeft: 6 }}>*</span>}
      {renderTooltip()}
    </label>
  );

  const stylesResolved = {
    height: compStyles?.height || "40px",
    bgColor: compStyles?.bgColor || "#fff",
    borderColor: compStyles?.borderColor || "#e5e7eb",
    borderWidth: compStyles?.borderWidth || "1px",
    borderRadius: compStyles?.borderRadius || "6px",
    padding: compStyles?.padding || "8px 12px",
  };

  switch (type) {
    case "dropdown":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
            {renderLabel(label)}
            <select
              disabled = {!preview}
              style={{
                ...getFieldStyles(),
                cursor: preview ? "pointer" : "not-allowed",
              }}
            >
              <option value="">{component?.placeholder || "Select an option..."}</option>
              {options?.map((o) => <option key={o.id} value={o.value}>{o.name}</option>)}
            </select>

            {!preview && options.length > 0 && (
              <div
              style={{
                marginTop: 6, 
                padding: 6, 
                background: "#f0f9ff", 
                borderRadius: 4, 
                fontSize: 11, 
                color: "#0369a1",
                border: "1px solid #bae6fd"
              }}
              >
                 <strong>Options:</strong> {options.map(o => o.name).join(" • ")}
              </div>
            )}
        </div>
      );

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
      )

    case "image_selector":
    return (
      <div style={{
        width: compStyles?.width || "100%",
        marginBottom: compStyles?.marginBottom || "16px",
      }}>
        {renderLabel(label)}
        {settings?.enableSwatch ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {options?.map((o,i) => (
              <label
                key={o.id || i}
                style={{
                  display: "flex", 
                  flexDirection: "column",
                  alignItems: "center", 
                  gap: 6, 
                  padding: 8, 
                  background: "#f9fafb", 
                  borderRadius: 6,
                  border: "2px solid #e5e7eb",
                  cursor: preview ? "pointer" : "default",
                  minWidth: 80
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
                <input
                  type="radio"
                  name={`image-${label}`} 
                  disabled={!preview} 
                  defaultChecked={i === 0}
                  style={{ marginTop: 4 }}
                />
              <span style={{ fontSize: 12, textAlign: "center" }}>{o.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <select disabled={!preview} style={getFieldStyles()}>
            <option value="">Select an option...</option>
            {options?.map((o) => <option key={o.id} value={o.value}>{o.name}</option>)}
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
          placeholder={component?.placeholder || "Enter number"} 
          disabled={!preview} 
          min={settings?.minValue || 0}
          max={settings?.maxValue || 10000}
          step={settings?.maxDecimal > 0 ? `0.${'0'.repeat(settings.maxDecimal - 1)}1` : 1}
          style={{
            ...getFieldStyles(),
            cursor: preview ? "text" : "not-allowed",
          }}
        />
        {settings?.useAsQuantity && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#3b82f6" }}>
            ℹ️ This will be used as product quantity
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
            placeholder={component?.placeholder || component?.settings?.placeholder || "Enter text"} 
            disabled={!preview}
            maxLength={component?.settings?.maxCharacters || 50}
            style={{
              ...getFieldStyles(),
              cursor: preview ? "text" : "not-allowed",
            }}
          />
          {component?.settings?.maxCharacters && (
            <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", textAlign: "right" }}>
              max {component.settings.maxCharacters} characters {component?.settings?.includeSpaceInLength && "(including spaces)"}
            </div>
          )}
      </div>
    );

   case "checkbox":
    if (!settings?.multipleSelection) {
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
              cursor: preview ? "pointer" : "not-allowed",
              fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
              fontSize: compStyles?.fontSize || "14px",
              fontWeight: compStyles?.fontWeight || "500",
              lineHeight: compStyles?.lineHeight || "1.5",
              letterSpacing: compStyles?.letterSpacing || "0px",
              color: compStyles?.textColor || "#374151",
            }}
          >
            <input type="checkbox" disabled={!preview}/>
            <span>
              {label}
              {settings?.required && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
            </span>
            {renderTooltip()}
          </label>
        </div>
      );
    }

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

        <div style={{ display: "flex", flexDirection: "column", gap: 8}}>
          {options?.map((opt, i) => (
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: compStyles?.padding || "10px",
              background: compStyles?.bgColor || "#f9fafb",
              borderRadius: compStyles?.borderRadius || "6px",
              border: `${compStyles?.borderWidth || "1px"} solid ${compStyles?.borderColor || "#e5e7eb"}`,
              cursor: preview ? "pointer" : "not-allowed",
              opacity: preview ? 1 : 0.9,
              fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
              fontSize: compStyles?.fontSize || "14px",
              fontWeight: compStyles?.fontWeight || "400",
              lineHeight: compStyles?.lineHeight || "1.5",
              letterSpacing: compStyles?.letterSpacing || "0px",
              color: compStyles?.textColor || "#374151",
            }}>
              <input type="checkbox" disabled={!preview}/>
              <span>{opt.name}</span>
              {!preview && (
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
                  value: {opt.value}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>
    );

    case "file_upload":
      return (
        <div style={{
          width: compStyles?.width || "100%",
          marginBottom: compStyles?.marginBottom || "16px",
        }}>
          {renderLabel(label, settings?.required)}
          <FileUploadComponent
            onFileSelect={(data) => setUploadedFile(data)}
            acceptedFormats={['.jpg', '.jpeg', '.png', '.pdf']}
            maxSize={10}
          />
          {uploadedFile && uploadedFile.type.startsWith('image/') && (
            <img
              src={uploadedFile.dataUrl} 
              alt="Preview" 
              style={{ 
                width: '100%', 
                maxHeight: 200, 
                objectFit: 'contain', 
                marginTop: 12, 
                borderRadius: 6 
              }} 
            />
          )}
        </div>
      );

  case "photo_editor":

    return(
      <div style={{
        width: compStyles?.width || "100%",
        marginBottom: compStyles?.marginBottom || "16px",
      }}>
        {renderLabel(label, settings?.required)}

        <FileUploadComponent
          onFileSelect={(data) => {
            if(data && data.type.startsWith('image/')){
              setPhotoUrl(data.dataUrl);
              setEditorOpen(true);
            } else if (data){
              alert('Please upload an image file (JPG, PNG)');
            }
          }}
          acceptedFormats={['.jpg', '.jpeg', '.png']}
          maxSize={10}
        />

        {editedPhoto && (
          <div style={{ marginTop: 12}}>
            <img
             src={editedPhoto}
             alt="Edited"
             style={{
              width: '100%', 
              borderRadius: 6, 
              border: '2px solid #10b981' 
             }}
            />
            <button
             onClick={() => {
              setPhotoUrl(editedPhoto);
              setEditorOpen(true);
             }}
             style={{
              marginTop: 8,
              width: '100%',
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: buttonStyle?.bgColor || '#3b82f6',
              color: buttonStyle?.textColor || '#fff',
              cursor: 'pointer',
              fontWeight: 500,
             }}
            >
              {buttonStyle?.buttonText || '✏️ Edit Again'}
            </button>
          </div>
        )}

        <PhotoEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={(editedData) => {
          setEditedPhoto(editedData);
          setEditorOpen(false);
        }}
        initialImage={photoUrl}
        />
      </div>
    );

  case "calculation_display":
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
          fontWeight: 600
        }}>
          {settings?.formulaPrefix && <span style={{ marginRight: 8 }}>{settings.formulaPrefix}</span>}
            <span>0.00</span>
          {settings?.formulaSuffix && <span style={{ marginLeft: 8 }}>{settings.formulaSuffix}</span>}
        </div>
        {settings?.formula && !preview && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            <strong>Formula:</strong> {settings.formula}
          </div>
        )}
        {settings?.useAsQuantity && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#3b82f6" }}>
            Result will be used as product quantity
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
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
            {settings?.input1Name || "Input 1"}
          </label>
          <input
            type="number" 
            disabled={!preview} 
            placeholder="Enter value" 
            style={{
              ...getFieldStyles(),
              height: "36px",
              cursor: preview ? "text" : "not-allowed",
            }}
          />
          </div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
              {settings?.input2Name || "Input 2"}
            </label>
            <input 
              type="number" 
              disabled={!preview} 
              placeholder="Enter value" 
              style={{
                ...getFieldStyles(),
                height: "36px",
                cursor: preview ? "text" : "not-allowed",
              }}
            />
          <div>
          {tableData && tableData.rows && tableData.rows.length > 0 && !preview && (
            <div style={{
              padding: 10, 
              background: "#ecfdf5", 
              border: "1px solid #6ee7b7", 
              borderRadius: 6, 
              fontSize: 12, 
              color: "#065f46" 
            }}>
              ✅ Table configured: {tableData.rows.length} rows × {tableData.columnHeaders?.length || 0} columns
            </div>
          )}
          {(!tableData || !tableData.rows || tableData.rows.length === 0) && !preview && (
            <div style={{
              padding: 10, 
              background: "#fef3c7", 
              border: "1px solid #fcd34d", 
              borderRadius: 6, 
              fontSize: 12, 
              color: "#92400e" 
            }}>
              ⚠️ No lookup table configured. Add data in properties panel.
            </div>
          )}
          </div>
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
        {options?.map((o, i) => (
          <label
          key={o.id || i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: compStyles?.padding || "8px",
            background: compStyles?.bgColor || "#f9fafb",
            borderRadius: compStyles?.borderRadius || "6px",
            border: `${compStyles?.borderWidth || "1px"} solid ${compStyles?.borderColor || "#e5e7eb"}`,
            cursor: preview ? "pointer" : "not-allowed",
            opacity: preview ? 1 : 0.9,
            fontFamily: compStyles?.fontFamily || "Inter, system-ui, sans-serif",
            fontSize: compStyles?.fontSize || "14px",
            fontWeight: compStyles?.fontWeight || "400",
            lineHeight: compStyles?.lineHeight || "1.5",
            letterSpacing: compStyles?.letterSpacing || "0px",
            color: compStyles?.textColor || "#374151",
          }}
          >
            <input 
              type="radio"
              name={`radio-${label}`}
              disabled={!preview}
              defaultChecked={i === 0}
            />
            <span>{o.name}</span>
            {!preview && (
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
                value: {o.value}
              </span>
            )}

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
        color: "#991b1b" 
      }}>
        unknown element type: {type}
      </div>
    );
  }
}


//==========cart settings panel==================
function CartSettingsPanel({ cartSettings, setCartSettings, components }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);

  //load products from shopify
  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_products' })
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
    setLoadingProducts(false);
  };


  //load variants when product is selected
  const loadVariants = async (productId) => {
    if (!productId) {
      setVariants([]);
      return;
    }
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'get_product_variants',
          data: { productId }
        })
      });
      const data = await response.json();
      if (data.success) {
        setVariants(data.variants);
      }
    } catch (error) {
      console.error('Error loading variants:', error);
    }
  };

  //add variant mapping
  const addVariantMapping = () => {
    const currentMappings = cartSettings.variantMapping || [];
    if (currentMappings.length >= 3) {
      alert('Maximum 3 variant options are allowed only');
      return;
    }
    setCartSettings({
      ...cartSettings,
      variantMapping: [...currentMappings, { elementId: '', optionName: ''}]
    });
  };

  //update variant mapping
  const updateVariantMapping = (index, field, value) => {
    const newMappings = [...(cartSettings.variantMapping || [])];
    newMappings[index] = {...newMappings[index], [field]: value };
    setCartSettings({ ...cartSettings, variantMapping: newMappings });
  };

  //remove variant mapping
  const removeVariantMapping = (index) => {
    const newMappings = (cartSettings.variantMapping || []).filter((_, i) => i !== index);
    setCartSettings({ ...cartSettings, variantMapping: newMappings });
  };

  const modes = [
    {
      id: 'existing_product',
      icon: '📦',
      title: 'Use Existing Product',
      shortDesc: "",
      fullDesc: 'Select a product from your Shopify store. Form data is saved as line item properties. Best for adding custom options to existing products.',
      whenToUse: 'Perfect for: Product customization, personalization, add-ons'
    },
    {
      id: 'dynamic_variant',
      icon: '⚡',
      title: 'Create Variant Dynamically',
      shortDesc: '',
      fullDesc: 'Automatically create new product variants based on customer selections. Each unique combination becomes a separate variant with its own SKU.',
      whenToUse: 'Perfect for: Bulk pricing, custom configurations, made-to-order products'
    },
    {
      id: 'draft_order',
      icon: '📋',
      title: 'Create Draft Order (Quote)',
      shortDesc:'',
      fullDesc: 'Generate a quote that requires admin approval before payment. Customer receives an invoice link after review. Ideal for wholesale and custom orders.',
      whenToUse: 'Perfect for: B2B sales, custom quotes, wholesale orders, approval workflows'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/*mode selection */}
      <div>
        <h3 style={{
          ...styles.heading2,
          margin: '0 0 12px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          Cart Behavior Mode
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modes.map(mode => (
            <button
              key={mode.id}
              onClick={() => setCartSettings({ ...cartSettings, mode: mode.id})}
              style={{
                padding: 12,
                border: cartSettings.mode === mode.id ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                borderRadius: 6,
                background: cartSettings.mode === mode.id ? '#eff6ff' : 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'start'}}>
                {/*icon*/}
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: cartSettings.mode === mode.id 
                    ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' 
                    : '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  flexShrink: 0,
                  border: cartSettings.mode === mode.id ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.2s ease'
                }}>
                  {mode.icon}
                </div>

                {/*content*/}
                <div style={{flex: 1}}>
                  {/*title ansd short desc*/}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ 
                      fontWeight: 700, 
                      fontSize: 16, 
                      color: '#1e40af'  
                    }}>
                      {mode.title}
                    </span>
                    {cartSettings.mode === mode.id && (
                      <span style={{ 
                        color: '#10b981', 
                        fontSize: 20, 
                        flexShrink: 0,
                        lineHeight: 1
                      }}>
                        ✓
                      </span>
                    )}
                    </div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#6366f1',
                      marginBottom: 6
                    }}>
                      {mode.shortDesc}
                    </div>
                  </div>

                  {/*full desc*/}
                  <p style={{
                    margin: '0 0 8px 0',
                    fontSize: 13,
                    lineHeight: '1.5',
                    color: '#475569'
                  }}>
                    {mode.fullDesc}
                  </p>

                  {/*when to use*/}
                  <div style={{
                    padding: '8px 12px',
                    background: cartSettings.mode === mode.id 
                      ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                      : '#f0f9ff',
                    borderRadius: 6,
                    borderLeft: '3px solid ' + (cartSettings.mode === mode.id ? '#10b981' : '#60a5fa')
                  }}>
                    <span style={{ 
                      fontSize: 12, 
                      color: '#1e3a8a',
                      fontWeight: 500
                    }}>
                    ℹ️ {mode.whenToUse}
                    </span>
                  </div>

              </div>
              
            </button>
          ))}
        </div>
      </div>

      {/*mode specific settings*/}
      <div style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        padding: 16
      }}>
        {cartSettings.mode === "existing_product" && (
          <ExistingProductSettings
            settings={cartSettings}
            setSettings={setCartSettings}
            products={products}
            variants={variants}
            loadingProducts={loadingProducts}
            onLoadProducts={loadProducts}
            onLoadVariants={loadVariants}
          />
        )}

        {cartSettings.mode === 'dynamic_variant' && (
          <DynamicVariantSettings
            settings={cartSettings}
            setSettings={setCartSettings}
            components={components}
            products={products}
            loadingProducts={loadingProducts}
            onLoadProducts={loadProducts}
            onAddMapping={addVariantMapping}
            onUpdateMapping={updateVariantMapping}
            onRemoveMapping={removeVariantMapping}
          />
        )}

        {cartSettings.mode === 'draft_order' && (
          <DraftOrderSettings
            settings={cartSettings}
            setSettings={setCartSettings}
          />
        )}
      </div>

      {/*common settings*/}
      <div>
        <h4 style={{ ...styles.heading2, margin: '0 0 12px 0', fontSize: 16 }}>
          After Submission Behavior
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10}}>
          <label style={propertyStyles.checkboxLabel}>
            <input
              type="checkbox"
              checked={cartSettings.redirectAfterAdd}
              onChange={(e) => setCartSettings({...cartSettings, redirectAfterAdd: e.target.checked})}
            />
            <span>Redirect to cart after adding</span>
          </label>

          <label style={propertyStyles.checkboxLabel}>
            <input
              type="checkbox"
              checked={cartSettings.showSuccessMessage}
              onChange={(e) => setCartSettings({ ...cartSettings, showSuccessMessage: e.target.checked})}
            />
            <span>Show success message</span>
          </label>

          {cartSettings.showSuccessMessage && (
            <input
              type="text"
              value={cartSettings.successMessage}
              onChange={(e) => setCartSettings({ ...cartSettings, successMessage: e.target.value})}
              style={{ ...propertyStyles.input, marginLeft: 24}}
              placeholder="Success Message"
            />
          )}
        </div>
      </div>

      {cartSettings.mode === "draft_order" && (
        <div style={{
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <h4 style={{ ...styles.heading2, margin: '0 0 12px 0', fontSize: 14, color: '#856404' }}>
            ⚠️ Customer Information Required
          </h4>
          <p style={{ ...styles.smallText, margin: '0 0 12px 0', color: '#856404' }}>
            For draft orders, you must collect customer email in your form. Add a text input element with ID <code>customerEmail</code>.
          </p>
          
          <label style={propertyStyles.checkboxLabel}>
            <input
              type="checkbox"
              checked={cartSettings.requireCustomerInfo}
              onChange={(e) => setCartSettings({
                ...cartSettings, 
                requireCustomerInfo: e.target.checked
              })}
            />
            <span>Require customer name and phone (optional fields)</span>
          </label>

          {cartSettings.requireCustomerInfo && (
            <p style={{ ...styles.smallText, marginLeft: 24, marginTop: 8, color: '#856404' }}>
              Add text inputs with IDs: <code>customerFirstName</code>, <code>customerLastName</code>, <code>customerPhone</code>
            </p>
          )}
        </div>
      )}
      
      {/*=========addvanced settings toggle
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{
          width: '100%',
          padding: 10,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 500,
          fontSize: 13,
          color: '#374151'
        }}
      >
        <span>⚙️ Advanced Options</span>
        <span style={{ 
          transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </span>
      </button>

      {showAdvanced && (
        <div style={{
          padding: 12,
          background: '#fefce8',
          border: '1px solid #fde68a',
          borderRadius: 6,
          fontSize: 12,
          color: '#854d0e'
        }}      
        >
          <strong>Advanced settings:</strong>
          <ul style={{ marginTop: 6, paddingLeft: 20, marginBottom: 0}}>
            <li>Custom line item properties mapping</li>
            <li>Metafield storage configuration</li>
            <li>Webhook triggers on submission</li>
            <li>Custom API endpoints</li>
          </ul>
        </div>
      )}
      
      ----------*/}
    
    </div>
  );
}

//===========existing product settings================
function ExistingProductSettings({
  settings,
  setSettings,
  products,
  variants,
  loadingProducts,
  onLoadProducts,
  onLoadVariants
}) {

const [showProductPicker, setShowProductPicker] = useState(false);
  
const selectedProduct = products.find(p => p.id === settings.baseProductId);
 
return (
  <div>
    <h4 style={{ ...styles.heading2, margin: '0 0 12px 0', fontSize: 16 }}>
      Product Configuration
    </h4>

    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
      <div>
         <label style={propertyStyles.labelSmall}>Base Product</label>

         {selectedProduct ? (
          <div style={{
            padding: 12,
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            display: 'flex',
            gap: 12,
            alignItems: 'center'
          }}>
            {selectedProduct.image ? (
              <img
                src={selectedProduct.image} 
                  alt={selectedProduct.title}
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: 'cover',
                    borderRadius: 4
                  }}
              />
            ) : (
              <div style={{
                  width: 40,
                  height: 40,
                  background: '#f3f4f6',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18
                }}>
                  📦
                </div>
            )}
            <div style={{ flex: 1}}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>
                {selectedProduct.title}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                ${selectedProduct.price}
              </div>
            </div>
            <button onClick={() => setShowProductPicker(true)}
              style={{
                padding: '6px 12px',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                color: '#374151'
              }}  
            >
              Change
            </button>
          </div>
         ) : (
          <button
            onClick={() => {
              if (!products.length){
                onLoadProducts();
              }
              setShowProductPicker(true);
            }}
            disabled={loadingProducts}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: loadingProducts ? 'wait' : 'pointer',
              textAlign: 'left',
              fontSize: 13,
              color: '#6b7280'
            }}
          >
              {loadingProducts ? 'Loading products...' : 'Select Product from Shopify'}
            </button>
         )}
         <div style={{ ...styles.smallText, marginTop: 4 }}>
            Choose the Shopify product to add to cart
         </div>
      </div>

      {settings.baseProductId && variants.length > 0 && (
        <div>
          <label style={propertyStyles.labelSmall}>Product Vriant (optional)</label>
          <select
            value={settings.productVariantId}
            onChange={(e) => setSettings({ ...settings, productVariantId:e.target.value})}
            style={propertyStyles.input}
          >
            <option value="">Use default variant</option>
            {variants.map(variant => (
              <option key={variant.id} value={variant.is}>
                {variant.title} - ${variant.price}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            Leave empty to use the first available variant
          </div>
        </div>
      )}

      <div style={{
        padding: 12,
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',  
        border: '2px solid #6ee7b7',
        borderRadius: 8,
        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)', 
      }}>
        <p style={{ ...styles.smallText, margin: 0, color: '#065f46' }}>
          <strong>✓ How it works:</strong> Form data will be added as line item properties. 
          The calculated price will be displayed but Shopify will use the product's configured price.
        </p>
      </div>
    </div>

    {/*price warning display*/}
    <div style={{
      background: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: 6,
      padding: 12,
      marginTop: 12
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
        <span style={{ fontSize: 20 }}>💡</span>
        <div>
          <strong style={{ fontSize: 13, color: '#856404' }}>
            Note: Calculated Price Limitation
          </strong>
          <p style={{ fontSize: 12, margin: '4px 0 0 0', color: '#856404' }}>
            Shopify's cart API doesn't support custom pricing for existing products. 
            Your calculated price will be shown in form but the cart will use the 
            product's actual Shopify price. For custom pricing, use "Draft Order" mode instead.
          </p>
        </div>
      </div>
    </div>

    {/*product picker modal*/}
    <ProductPickerModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={(product) => {
          setSettings({
            ...settings, 
            baseProductId: product.id,
            productVariantId: ''
          });
          onLoadVariants(product.id);
        }}
        products={products}
        loading={loadingProducts}
      />
  </div>
);
}

//========dynamic variant settings===============
function DynamicVariantSettings({ 
  settings, 
  setSettings, 
  components,
  products,
  loadingProducts,
  onLoadProducts,
  onAddMapping,
  onUpdateMapping,
  onRemoveMapping
}){
  const [showProductPicker, setShowProductPicker] = useState(false);
  const variantMapping = settings.variantMapping || [];
  const interactiveElements = components.filter(c => 
    ['dropdown', 'radio', 'image_selector', 'text_input'].includes(c.type)
  );

  
  const selectedProduct = products.find(p => p.id === settings.baseProductId);

  return (
    <div>
      <h4 style={{ ...styles.heading2, margin: '0 0 12px 0', fontSize: 16 }}>
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={propertyStyles.labelSmall}>Base Product</label>

          {selectedProduct ? (
            <div style={{
              padding: 12,
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              display: 'flex',
              gap: 12,
              alignItems: 'center'
            }}>
              {selectedProduct.image ? (
                <img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.title}
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: 'cover',
                    borderRadius: 4
                  }}
                />
              ) : (
                <div style={{
                  width: 40,
                  height: 40,
                  background: '#f3f4f6',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18
                }}>
                  📦
                </div>
              )}
              <div style ={{flex: 1}}>
                <div style={{ fontWeight: 500, fontSize: 13}}>
                  {selectedProduct.title}
                </div>
              </div>
              <button 
                onClick={() => setShowProductPicker(true)}
                style={{
                  padding: '6px 12px',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#374151'
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!products.length){
                  onLoadProducts();
                }
                setShowProductPicker(true);
              }}
              disabled={loadingProducts}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: loadingProducts ? 'wait' : 'pointer',
                textAlign: 'left',
                fontSize: 13,
                color: '#6b7280'
              }}
            >
             {loadingProducts ? 'Loading products...' : 'Select Product from Shopify'}
            </button>
          )}
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            New variants will be created under this product
          </div>
        </div>

        <div>
          <label style={{ ...propertyStyles.labelSmall, marginBottom: 6 }}>
            Variant Options Mapping (max 3)
          </label>

          {variantMapping.length === 0 ? (
            <div style={{
              padding: 12,
              background: 'white',
              border: '1px dashed #d1d5db',
              borderRadius: 6,
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 12
            }}>
              No mappings yet. Click "Add Option" to start.
            </div>
          ) : (
            variantMapping.map((mapping, idx) => (
              <div key={idx} style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 36px', 
                gap: 6, 
                marginBottom: 6,
                padding: 8,
                background: 'white',
                borderRadius: 6,
                border: '1px solid #e5e7eb'
              }}>
                <select
                  value={mapping.elementId}
                  onChange={(e) => onUpdateMapping(idx, 'elementId', e.target.value)}
                  style={propertyStyles.inputSmall}
                >
                  <option value="">Select element</option>
                  {interactiveElements.map(el => (
                    <option key={el.id} value={el.id}>{el.label}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={mapping.optionName}
                  onChange={(e) => onUpdateMapping(idx, 'optionName', e.target.value)}
                  placeholder="Option name"
                  style={propertyStyles.inputSmall}
                />

                  <button onClick={() => onRemoveMapping}
                    style={{
                      background: '#fee2e2',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#991b1b',
                      padding: 0
                    }}  
                    title="Remove"
                  >
                    🗑️
                  </button>
              </div>
            ))
          )}

          {/*inventory settings*/}
          <div style={{ marginTop: 16 }}>
            <h4 style={{ ...styles.heading2, fontSize: 14, margin: '0 0 12px 0' }}>
              📦 Inventory Settings
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={propertyStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={settings.trackInventory}
                  onChange={(e) => setSettings({
                    ...settings,
                    trackInventory: e.target.checked
                  })}
                />
                <span>Track inventory for created variants</span>
              </label>

              {settings.trackInventory && (
                <>
                  <div>
                    <label style={propertyStyles.label}>Default Inventory Quantity</label>
                    <input
                      type="number"
                      value={settings.defaultInventoryQty || 100}
                      onChange={(e) => setSettings({
                        ...settings,
                        defaultInventoryQty: parseInt(e.target.value) || 0
                      })}
                      style={propertyStyles.input}
                      min="0"
                    />
                    <small style={styles.smallText}>
                      Initial stock for newly created variants
                    </small>
                  </div>

                  <div>
                    <label style={propertyStyles.label}>When out of stock</label>
                    <select
                      value={settings.inventoryPolicy || "deny"}
                      onChange={(e) => setSettings({
                        ...settings,
                        inventoryPolicy: e.target.value
                      })}
                      style={propertyStyles.input}
                    >
                      <option value="deny">Don't allow purchases</option>
                      <option value="continue">Allow purchases (oversell)</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {variantMapping.length < 3 && (
            <button
              onClick={onAddMapping}
              style={{
                width: '100%',
                padding: 8,
                background: 'white',
                border: '1px dashed #3b82f6',
                borderRadius: 4,
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                marginTop: 6
              }}
            >
              + Add option
            </button>
          )}
        </div>

        <div>
          <label style={propertyStyles.checkboxLabel}>
            <input
              type="checkbox"
              checked={settings.generateSKU}
              onChange={(e) => setSettings({ ...settings, generateSKU: e.target.checked})}
            />
            <span>Auto-generate SKU</span>
          </label>

          {settings.generateSKU && (
            <input
              type="text"
              value={settings.skuPrefix}
              onChange={(e) => setSettings({...settings, skuPrefix: e.target.value})}
              placeholder="SKU Prefix"
              style={{ ...propertyStyles.input, marginTop: 8, marginLeft: 24 }}
            />
          )}
        </div>

        <div style={{
          padding: 12,
          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          border: '2px solid #6ee7b7', 
          borderRadius: 8,
          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)',  
        }}>
          <p style={{ ...styles.smallText, margin: 0, color: '#065f46' }}>
            <strong>⚡ Example:</strong> If customer selects "Large" for Size element, a new variant 
             "Large" will be created with the calculated price from your form.
        
          </p>
          </div>
      </div>

      <ProductPickerModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={(product) => {
          setSettings({
            ...settings, 
            baseProductId: product.id
          });
        }}
        products={products}
        loading={loadingProducts}
      />
    </div>
  )

  
}

//=============draft order setting==================
function DraftOrderSettings({settings, setSettings}){
  return (
    <div>
      <h4 style={{ ...styles.heading2, margin: '0 0 12px 0', fontSize: 16 }}>
        Draft Order Configuration
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={propertyStyles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.requiresApproval}
            onChange={(e) => setSettings({...settings, requiresApproval: e.target.checked})}
          />
          <span>Require admin approval</span>
        </label>

        <label style={propertyStyles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.sendEmail}
            onChange={(e) => setSettings({...settings, sendEmail: e.target.checked})}
          />
          <span>Send email notification to customer</span>
        </label>

        {settings.sendEmail && (
          <>
            <div>
              <label style={propertyStyles.labelSmall}>Email Subject Line</label>
              <input
                type="text"
                value={settings.emailSubject}
                onChange={(e) => setSettings({...settings, emailSubject: e.target.value})}
                style={propertyStyles.input}
                placeholder="Your Custom Quote is Ready"
              />
            </div>

            <div>
               <label style={propertyStyles.labelSmall}>Order Note Template</label>
                <textarea
                  value={settings.orderNoteTemplate}
                  onChange={(e) => setSettings({...settings, orderNoteTemplate: e.target.value})}
                  rows={6}
                  style={{
                    ...propertyStyles.input,
                    fontFamily: 'Monaco, monospace',
                    fontSize: 12,
                    resize: 'vertical'
                  }}
                  placeholder="Custom form submission&#10;&#10;Configuration:&#10;{{form_data}}&#10;&#10;Total: {{calculated_price}}"
                />
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  Use for dynamic content
                </div>
            </div>
          </>
        )}

        <div style={{
          padding: 12,
          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          border: '2px solid #6ee7b7', 
          borderRadius: 8,
          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)',  
        }}>
          <p style={{ ...styles.smallText, margin: 0, color: '#065f46' }}>
            <strong>📋 How it works:</strong> A draft order will be created in Shopify admin. 
            Customer receives an invoice link to complete payment. Perfect for B2B or custom quotes.
        
          </p>
          </div>
      </div>
    </div>
  );
}

//===product picker modal====
 
function ProductPickerModal({ isOpen, onClose, onSelect, products, loading }) {
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  if (!isOpen) return null;

  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}
    onClick={onClose}
    >
      <div style={{
        background: 'white',
        borderRadius: 12,
        width: '100%',
        maxWidth: 600,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/*header*/}
        <div style={{
          padding: 20,
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Select Product
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0,
              lineHeight: 1
            }}
          >
            x
          </button>
        </div>

        {/*search*/}
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb'}}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Products"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              outline: 'none'
            }}
            autoFocus
          />
        </div>

        {/*products list*/}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              Loading products...
            </div>
          ): filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              No products found
            </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  style={{
                    padding: 12,
                    border: selectedProduct?.id === product.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: 6,
                    background: selectedProduct?.id === product.id ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center'
                  }}
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.title}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: 'cover',
                        borderRadius: 4,
                        border: '1px solid #e5e7eb'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 48,
                      height: 48,
                      background: '#f3f4f6',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20
                    }}>
                      📦
                    </div>
                  )}
                  <div style={{ flex: 1}}>
                    <div style={{ fontWeight: 500, fontSize: 14, color: '#111827' }}>
                      {product.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      ${product.price}
                    </div>
                  </div>
                  {selectedProduct?.id === product.id && (
                    <span style={{ color: '#10b981', fontSize: 18 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/*footer*/}
        <div style={{
          padding: 16,
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Cancel
          </button>
          <button
            onClick={()=>{
              if (selectedProduct) {
                onSelect(selectedProduct);
                onClose();
              }
            }}
            disabled={!selectedProduct}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: 6,
              background: selectedProduct ? '#3b82f6' : '#d1d5db',
              color: 'white',
              cursor: selectedProduct ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Select Product
          </button>

        </div>
      </div>

    </div>
  )
}

// ==================== styles ====================
const styles = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(135deg, #e0f2fe 0%, #fef3c7 100%)",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
  },

  topBar: {
    background: "linear-gradient(90deg, #ffffff 0%, #f0f9ff 100%)",
    borderBottom: "2px solid #60a5fa",
    boxShadow: "0 2px 8px rgba(96, 165, 250, 0.1)",  // 
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",  
  },

  backBtn: {
    background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",  // 💙 Blue gradient
    border: "2px solid #60a5fa",
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#1e40af",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(96, 165, 250, 0.2)",
  },

  smallBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "2px solid #bfdbfe",
    cursor: "pointer",
    background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",
    color: "#1e40af",
    fontWeight: 600,
    fontSize: 14,
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(96, 165, 250, 0.15)",
  },

  primaryBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",  // 🎨 Vibrant blue
    color: "#fff",
    fontWeight: 700,  // 💪 Bold!
    fontSize: 14,
    transition: "all 0.2s ease",
    boxShadow: "0 4px 8px rgba(59, 130, 246, 0.3)",  // ✨ Glow effect
  },


  editorContainer: {
    display: "flex",
    flex: 1,
    height: "calc(100% - 64px)",
    overflow: "hidden",
  },

  canvasArea: {
    flex: 4.5,  
    display: "flex",
    flexDirection: "column",
    overflow: "auto", //allow scrolling
    overflowX: "hidden", //alow only vertical scroll
    marginRight: 16,
    padding: 20,
    background: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
    boxShadow: "0 4px 16px rgba(96, 165, 250, 0.1)",
    scrollBehavior: "smooth",
  },

  canvasScrollableContent: {
    flex: "1 1 auto",
    minHeight: "400px",  
    maxHeight: "calc(100% - 270px)",
    overflowY: "auto",
    overflowX: "hidden",
    padding: 20,
    background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)", 
    borderRadius: 12,
    border: "2px solid #bfdbfe", 
    marginBottom: 16,
    boxShadow: "0 2px 8px rgba(96, 165, 250, 0.1)",
  },

  canvasSectionTabsContainer: {
  
    flex: "0 0 auto",
    borderTop: "2px solid #bfdbfe",  
    background: "linear-gradient(135deg, #ffffff 0%, #fef3c7 50%, #f0f9ff 100%)",  
    borderRadius: 12,
    maxHeight: "350px", 
    minHeight: "250px",
    overflowY: "auto",
    boxShadow: "0 -2px 8px rgba(96, 165, 250, 0.1)", 
  },

  
  dropZonePlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
    minHeight: 500,
    background: "linear-gradient(135deg, #dbeafe 0%, #fef3c7 100%)", 
    borderRadius: 16,
    border: "3px dashed #60a5fa",  
    boxShadow: "inset 0 2px 8px rgba(96, 165, 250, 0.1)",
  },

    
  componentWrapper: {
    padding: 16,
    background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",
    borderRadius: 12,
    border: "2px solid #bfdbfe",
    position: "relative",
    marginBottom: 12,
    transition: "all 0.2s ease",
    boxShadow: "0 2px 6px rgba(96, 165, 250, 0.1)",
  },

  componentWrapperSelected: {
    background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",  
    boxShadow: "0 6px 16px rgba(59, 130, 246, 0.2)",
    borderColor: "#3b82f6",
    transform: "translateY(-2px)",  
  },

  componentActions: {
    position: "absolute",
    right: 8,
    top: 8,
    display: "flex",
    gap: 6,
    zIndex: 10,
  },

  editButton: {
    background: "#dbeafe",
    border: "1px solid #3b82f6",
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    color: "#1e40af",
    transition: "all 0.2s",
  },

  copyButton: {
    background: "#d1fae5",
    border: "1px solid #10b981",
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    color: "#065f46",
    transition: "all 0.2s",
  },

  deleteButton: {
    background: "#fee2e2",
    border: "1px solid #ef4444",
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    color: "#991b1b",
    transition: "all 0.2s",
  },

  conditionalBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    background: "#fef3c7",
    border: "1px solid #fcd34d",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    color: "#854d0e",
  },

  dragHandle: {
    position: "absolute",
    left: 8,
    top: "50%",
    transform: "translateY(-50%)",
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    background: "#f3f4f6",
    cursor: "grab",
    zIndex: 12,
    fontSize: 14,
    userSelect: "none",
  },

    
  sidebar: {
    width: 300,  
    borderLeft: "2px solid #bfdbfe",  
    padding: 16,
    background: "linear-gradient(180deg, #fef3c7 0%, #f0f9ff 100%)", 
    boxShadow: "-4px 0 12px rgba(96, 165, 250, 0.1)",
  },

  tabButton: {
    padding: "10px 14px",
    borderRadius: 8,
    background: "#ffffff",
    border: "2px solid #bfdbfe",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#1e40af",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(96, 165, 250, 0.1)",
  },

  tabButtonActive: {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    borderColor: "#2563eb",
    color: "#ffffff",  // 💪 White text
    fontWeight: 700,
    transform: "translateY(-2px)",  // 🎯 Lift effect
    boxShadow: "0 4px 8px rgba(59, 130, 246, 0.3)",
  },

  sidebarTabs: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },

  tabButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  sidebarContent: {
    height: "calc(100% - 56px)",
    overflowY: "auto",
  },

  
  heading1: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#1e40af",
    marginBottom: "12px",
    letterSpacing: "0.5px",
  },

  heading2: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1e40af",
    marginBottom: "10px",
  },

  bodyText: {
    fontSize: "14px",
    fontWeight: 400,
    color: "#1e3a8a",
    lineHeight: "1.6",
  },

  smallText: {
    fontSize: "12px",
    fontWeight: 400,
    color: "#475569",
    lineHeight: "1.5"
  },

  scrollHint: {
    position: "sticky",
    bottom: 0,
    left: 0,
    right: 0,
    height: "30px",
    background: "linear-gradient(to top, rgba(96, 165, 250, 0.1), transparent)",
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    color: "#60a5fa",
    fontWeight: 600,
  },
};

// ==================== PROPERTY STYLES ====================

const propertyStyles = {
  sectionWhite: {
    padding: 16,
    background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",  
    borderBottom: "2px solid #bfdbfe",
    marginBottom: 12,
    borderRadius: 10,
    boxShadow: "0 2px 4px rgba(96, 165, 250, 0.05)",
  },

  sectionBlue: {
    padding: 16,
    background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",  
    borderBottom: "2px solid #60a5fa",
    marginBottom: 12,
    borderRadius: 10,
    boxShadow: "0 2px 4px rgba(96, 165, 250, 0.15)",
  },

  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,  
    fontWeight: 700,  
    color: "#1e40af",  
    letterSpacing: "0.3px", 
  },

  labelSmall: {
    display: "block",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 600,
    color: "#1e40af",
  },

  input: {
    width: "100%",
    padding: "10px 14px",
    border: "2px solid #bfdbfe",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    background: "#ffffff",
    transition: "all 0.2s ease",
    fontWeight: 500,
  },

  inputSmall: {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    margin: 0,
  },

    
  inputFocus: {
    borderColor: "#3b82f6",  
    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)"
  },

  buttonHover: {
    transform: "translateY(-2px)",  
    boxShadow: "0 6px 12px rgba(59, 130, 246, 0.2)",
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },

  deleteBtn: {
    background: "#fee2e2",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: "6px",
    cursor: "pointer",
    fontSize: 14,
  },

  uploadBtn: {
    background: "#dbeafe",
    border: "1px solid #93c5fd",
    borderRadius: 4,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 500,
    color: "#1e40af",
    textAlign: "center",
  },

  addMoreBtn: {
    width: "100%",
    padding: "8px 12px",
    background: "#fff",
    border: "1px dashed #3b82f6",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: "#3b82f6",
    transition: "all 0.2s",
  },

  toolbarBtn: {
    padding: "6px 10px",
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
    minWidth: 32,
  },

  additionalInfo: {
    padding: 12,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 6,
    fontSize: 12,
    color: "#1e40af",
    lineHeight: 1.6,
    margin: "12px 0",
  },
};

//============================================================
const photoEditorStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: '95%',
    maxWidth: 1100,
    maxHeight: '95vh',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottom: '1px solid #e5e7eb',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 28,
    cursor: 'pointer',
    color: '#6b7280',
  },
  body: {
    padding: 20,
  },
  canvasWrap: {
    background: '#f3f4f6',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    display: 'flex',
    justifyContent: 'center',
  },
  canvas: {
    maxWidth: '100%',
    border: '2px solid #e5e7eb',
    borderRadius: 4,
    background: '#fff',
  },
  toolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  toolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    background: '#f9fafb',
    borderRadius: 6,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    minWidth: 100,
  },
  btn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  btnActive: {
    background: '#3b82f6',
    color: '#fff',
    borderColor: '#3b82f6',
  },
  slider: {
    flex: 1,
    maxWidth: 200,
  },
  value: {
    fontSize: 13,
    fontWeight: 500,
    minWidth: 50,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
  },
  color: {
    width: 50,
    height: 36,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 20,
    borderTop: '1px solid #e5e7eb',
  },
  resetBtn: {
    padding: '10px 20px',
    borderRadius: 6,
    border: '1px solid #f59e0b',
    background: '#fff',
    color: '#f59e0b',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    background: '#fff',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 20px',
    borderRadius: 6,
    border: 'none',
    background: '#059669',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 500,
  },
};

const dataLookupStyles = {
  container: {
    background: '#fff',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #e5e7eb',
    marginTop: 12,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  toolbarLeft: {
    display: 'flex',
    gap: 8,
  },
  toolbarRight: {
    display: 'flex',
    gap: 8,
  },
  addBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: '#10b981',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  editHeaderBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #3b82f6',
    background: '#fff',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  templateBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #8b5cf6',
    background: '#fff',
    color: '#8b5cf6',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  importBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #3b82f6',
    background: '#fff',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    display: 'inline-block',
  },
  exportBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #f59e0b',
    background: '#fff',
    color: '#f59e0b',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  infoBox: {
    padding: 12,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 12,
    color: '#1e40af',
  },
  tableWrapper: {
    overflowX: 'auto',
    marginBottom: 12,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    background: '#f3f4f6',
    padding: 10,
    textAlign: 'left',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: 600,
    color: '#374151',
    fontSize: 12,
  },
  thActions: {
    background: '#f3f4f6',
    padding: 10,
    textAlign: 'center',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: 600,
    width: 80,
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  headerBadge: {
    padding: '2px 6px',
    borderRadius: 4,
    background: '#dbeafe',
    color: '#1e40af',
    fontSize: 10,
    fontWeight: 600,
  },
  headerBadgeOutput: {
    padding: '2px 6px',
    borderRadius: 4,
    background: '#dcfce7',
    color: '#166534',
    fontSize: 10,
    fontWeight: 600,
  },
  headerInput: {
    width: '100%',
    padding: '4px 6px',
    border: '1px solid #3b82f6',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  evenRow: {
    background: '#fff',
  },
  oddRow: {
    background: '#f9fafb',
  },
  td: {
    padding: 8,
    borderBottom: '1px solid #e5e7eb',
  },
  tdActions: {
    padding: 8,
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'center',
  },
  cellInput: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: 13,
    boxSizing: 'border-box',
  },
  deleteBtn: {
    background: '#fee2e2',
    border: 'none',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    textAlign: 'center',
    color: '#9ca3af',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  stats: {
    display: 'flex',
    gap: 16,
    padding: 10,
    background: '#f9fafb',
    borderRadius: 6,
  },
  statItem: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 500,
  },
};
