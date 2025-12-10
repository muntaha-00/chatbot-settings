import React, { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { json } from "../utils/response";
import * as XLSX from "xlsx";



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
    defaultTableData: null, //stores excel data as json
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

        case "heading": 
        return {
          ...baseComponent,
          content: parsedMetadata.content || {text: "Form Heading"},
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

  // handle excel file upload
  const handleExcelUpload = (e, onUpdateTableData) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: "binary" });

        // get first sheet
        const sheetName = workbook.SheetNames[0];
        const workSheet = workbook.Sheets[sheetName];

        // convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(workSheet);

        onUpdateTableData({
          fileName: file.name,
          data: jsonData,
          uploadDate: new Date().toISOString(),
          headers: Object.keys(jsonData[0] || {}),
        });
      } catch (error) {
        console.error("Error reading Excel file:", error);
        alert("Error reading Excel Sheet. Please make sure it's a valid excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  // drag & drop helpers
const handleDragStart = (e, type) => {
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData("text/plain", `type:${type}`);
  console.log("Drag started(sidebar):", type);
};

const handleComponentDragStart = (e, index) => {
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", `move:${index}`);
  console.log("Component drag started (canvas):", index);
};

//main canvas drop handler(for new elements from sidebar)
const handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();

  const data = e.dataTransfer.getData("text/plain");
  console.log("Drop received (canvas):", data);

  // Check if it's a new component from sidebar
  if (data && data.startsWith("type:")) {
    const type = data.split(":")[1];
    if (type) {
      addComponent(type);
    }
  }
};


const handleDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "copy";
};

const handleComponentDrop = (e, dropIndex) => {
  e.preventDefault();
  e.stopPropagation();

  const data = e.dataTransfer.getData("text/plain");
  

  // Only process reorder operations (starts with move)
  if (!data || !data.startsWith("move:")) {
  return;
  }
  
  const fromIndex = parseInt(data.split(":")[1], 10);

  if (isNaN(fromIndex) || fromIndex === dropIndex) {
    return;
  }

  console.log(`Reordering: index ${fromIndex} -> ${dropIndex}`);

  setComponents((prev) => {
    const copy = [...prev];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(dropIndex, 0, moved);
    return copy;
  });
  
};

const handleComponentDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "move";
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

      console.log(`🔍 CLIENT DEBUG - ${comp.type} metadata:`, metadata);

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
    // save canvas
    formData.append("formulaSettings", JSON.stringify(formulaSettings));
    formData.append("productSettings", JSON.stringify(productSettings));
    formData.append("nonProductSettings", JSON.stringify(nonProductSettings));
    formData.append("advancedSettings", JSON.stringify(advancedSettings));

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
          <h3 style={{ marginBottom: 8, color: "#374151" }}>drag elements here</h3>
          <div style={{ color: "#9ca3af" }}>start building your form by dragging elements from the sidebar</div>
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
              onDragOver={handleComponentDragOver}
              onDrop={(e) => handleComponentDrop(e, index)}
              onClick={() => {
                setSelectedComponentIndex(index);
                setActiveTab("properties");
              }}
              style={{
                ...styles.componentWrapper,
                ...(selectedComponentIndex === index ? styles.componentWrapperSelected : {}),
                cursor: "grab",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.cursor = "grabbing";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.cursor = "grab";
              }}
            >
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
        {["formula", "products", "non-products", "advanced"].map((tab) => (
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
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: 16 }}>
        {activeTab === "formula" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={propertyStyles.label}>Formula</label>
              <input
                type="text"
                value={formulaSettings.formula}
                onChange={(e) => setFormulaSettings({ ...formulaSettings, formula: e.target.value })}
                style={propertyStyles.input}
                placeholder="e.g., [element_1] * [element_2]"
              />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Start typing to see suggestions, Press tab to insert, ↓ to browse, or{" "}
                <a href="#" style={{ color: "#3b82f6" }}>learn more about formula</a>
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

  // excel file upload handler for data lookup
  const handleExcelUploadLocal = (e) => {
    handleExcelUpload(e, onUpdateTableData);
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

    return (
      <div style={{ ...propertyStyles.sectionWhite, background: "#fef3c7", borderColor: "#fcd34d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <label style={{ ...propertyStyles.label, marginBottom: 0 }}>Conditional Display</label>
        </div>

        <label style={propertyStyles.checkboxLabel}>
          <input type="checkbox" checked={conditionalDisplay?.enabled || false} 
          onChange={(e) => onUpdateConditionalDisplay({ ...conditionalDisplay, enabled: e.target.checked })} />
          <span>Enable Conditional Display</span>
        </label>

        {conditionalDisplay?.enabled && (
          <>
            <div style={{ marginTop: 12 }}>
              <label style={propertyStyles.labelSmall}>Value When Not Displayed</label>
              <input type="number" value={conditionalDisplay?.valueWhenNotDisplayed || "1"} 
              onChange={(e) => onUpdateConditionalDisplay({ ...conditionalDisplay, valueWhenNotDisplayed: e.target.value })} 
              style={propertyStyles.input} placeholder="1" />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Value used in formulas when this element is hidden
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={propertyStyles.labelSmall}>Select Trigger Element (Image Selector)</label>
              <select value={conditionalDisplay?.triggerElementId || ""} 
              onChange={(e) => onUpdateConditionalDisplay({ ...conditionalDisplay, triggerElementId: e.target.value })} 
              style={propertyStyles.input}>
                <option value="">--Select Image Selector--</option>
                {imageSelectorElements.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.label || `Image Selector ${el.index + 1}`}
                  </option>
                ))}
              </select>
              {imageSelectorElements.length === 0 && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ No Image Selector elements available. Add an Image Selector element first.</div>}
            </div>

            <div style={{ marginTop: 12, padding: 10, background: "#fef9c3", borderRadius: 4, fontSize: 11, color: "#854d0e" }}>
              💡 <strong>How it works:</strong> This element will only be visible when a specific option is selected in the chosen Image Selector element.
            </div>
          </>
        )}
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
            <label style={propertyStyles.label}>Number Input Settings</label>

            <label style={propertyStyles.checkboxLabel}>
              <input type="checkbox" checked={settings?.useAsQuantity || false} onChange={(e) => onUpdateSettings({ ...(settings || {}), useAsQuantity: e.target.checked })} />
              <span>Use as Quantity (Product Cart Quantity)</span>
            </label>

            {!settings?.useAsQuantity && (
              <>
                <label style={{ ...propertyStyles.labelSmall, marginTop: 8 }}>Max Decimal Places</label>
                <input type="range" min="0" max="10" value={settings?.maxDecimal || 0} onChange={(e) => onUpdateSettings({ ...(settings || {}), maxDecimal: parseInt(e.target.value, 10) })} style={{ width: "100%" }} />
                <div style={{ fontSize: 12, color: "#6b7280" }}>Current: {settings?.maxDecimal || 0}</div>
              </>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label style={propertyStyles.labelSmall}>Minimum Value</label>
                <input type="number" value={settings?.minValue || "0"} onChange={(e) => onUpdateSettings({ ...(settings || {}), minValue: e.target.value })} style={propertyStyles.inputSmall} placeholder="0" />
              </div>
              <div>
                <label style={propertyStyles.labelSmall}>Maximum Value</label>
                <input type="number" value={settings?.maxValue || "10000"} onChange={(e) => onUpdateSettings({ ...(settings || {}), maxValue: e.target.value })} style={propertyStyles.inputSmall} placeholder="10000" />
              </div>
            </div>
          </div>

          <div style={propertyStyles.sectionWhite}>
            <label style={propertyStyles.label}>Value Ranges (Bulk Pricing)</label>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Define different values based on input ranges (e.g., quantity discounts)</div>
            {valueRanges.map((r) => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 40px", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input type="number" value={r.start} onChange={(e) => updateValueRange(r.id, "start", e.target.value)} style={propertyStyles.inputSmall} placeholder="Start" />
                <input type="number" value={r.end} onChange={(e) => updateValueRange(r.id, "end", e.target.value)} style={propertyStyles.inputSmall} placeholder="End" />
                <input type="number" value={r.value} onChange={(e) => updateValueRange(r.id, "value", e.target.value)} style={propertyStyles.inputSmall} placeholder="Value" />
                <button onClick={() => deleteValueRange(r.id)} disabled={valueRanges.length <= 1} style={propertyStyles.deleteBtn} title="Delete range">🗑️</button>
              </div>
            ))}
            <button onClick={addValueRange} style={propertyStyles.addMoreBtn}>+ Add Value Range</button>
          </div>
          {renderConditionalDisplaySection()}
          {renderTooltipSection()}
          {renderAdditionalInfoSection()}
        </>
      )}

      {type === "calculation_display" && (
        <>
          <div style={propertyStyles.sectionBlue}>
            <label style={propertyStyles.label}>Formula</label>
            <input type="text" value={settings?.formula || ""} onChange={(e) => onUpdateSettings({ ...(settings || {}), formula: e.target.value })} style={propertyStyles.input} placeholder="e.g., [element_1] * [element_2] + 10" />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Use [element_X] to reference other elements by their position</div>
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
          <div style={propertyStyles.sectionBlue}>
            <label style={propertyStyles.label}>Upload Data Table</label>
            <label style={{ ...propertyStyles.uploadBtn, cursor: "pointer", textAlign: "center" }}>
              Upload Excel File
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUploadLocal} style={{ display: "none" }} />
            </label>
          </div>

          <div style={propertyStyles.sectionWhite}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: "#374151" }}>Input 1 configuration</div>

            <label style={propertyStyles.labelSmall}>Input 1 name</label>
            <input type="text" value={settings?.input1Name || "Input 1"} onChange={(e) => onUpdateSettings({ ...(settings || {}), input1Name: e.target.value })} style={propertyStyles.input} placeholder="Input 1" />

            <label style={{ ...propertyStyles.checkboxLabel, marginTop: 8 }}>
              <input type="checkbox" checked={settings?.input1Formula || false} onChange={(e) => onUpdateSettings({ ...(settings || {}), input1Formula: e.target.checked })} />
              <span>Is Input 1 based on formula?</span>
            </label>

            {settings?.input1Formula && (
              <>
                <label style={{ marginTop: 8, display: "block", fontSize: 12 }}>Formula for input 1</label>
                <input type="text" value={settings?.input1FormulaText || ""} onChange={(e) => onUpdateSettings({ ...(settings || {}), input1FormulaText: e.target.value })} style={propertyStyles.input} placeholder="e.g., [element_1] * 2" />
              </>
            )}

            <label style={{ marginTop: 8, display: "block", fontSize: 12 }}>Maximum Decimal</label>
            <input type="range" min="0" max="10" value={settings?.input1MaxDecimal || 0} onChange={(e) => onUpdateSettings({ ...(settings || {}), input1MaxDecimal: parseInt(e.target.value, 10) })} style={{ width: "100%" }} />
            <div style={{ fontSize: 12, color: "#6b7280" }}>Current: {settings?.input1MaxDecimal || 0}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Min Value</label>
                <input type="number" value={settings?.input1MinValue || "0"} onChange={(e) => onUpdateSettings({ ...(settings || {}), input1MinValue: e.target.value })} style={propertyStyles.inputSmall} placeholder="0" />
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>*Based on table values</div>
              </div>
              <div>
                <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Max Value</label>
                <input type="number" value={settings?.input1MaxValue || "10000"} onChange={(e) => onUpdateSettings({ ...(settings || {}), input1MaxValue: e.target.value })} style={propertyStyles.inputSmall} placeholder="10000" />
              </div>
            </div>
          </div>

          <div style={propertyStyles.sectionBlue}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: "#374151" }}>Input 2 Configuration</div>

            <label style={propertyStyles.labelSmall}>Input 2 Name</label>
            <input type="text" value={settings?.input2Name || "Input 2"} onChange={(e) => onUpdateSettings({ ...(settings || {}), input2Name: e.target.value })} style={propertyStyles.input} placeholder="Input 2" />

            <label style={{ ...propertyStyles.checkboxLabel, marginTop: 8 }}>
              <input type="checkbox" checked={settings?.input2Formula || false} onChange={(e) => onUpdateSettings({ ...(settings || {}), input2Formula: e.target.checked })} />
              <span>Is Input 2 based on formula?</span>
            </label>

            {settings?.input2Formula && (
              <>
                <label style={{ marginTop: 8, display: "block", fontSize: 12 }}>Formula for Input 2</label>
                <input type="text" value={settings?.input2FormulaText || ""} onChange={(e) => onUpdateSettings({ ...(settings || {}), input2FormulaText: e.target.value })} style={propertyStyles.input} placeholder="e.g., [element_2] + 5" />
              </>
            )}

            <label style={{ marginTop: 8, display: "block", fontSize: 12 }}>Maximum Decimal</label>
            <input type="range" min="0" max="10" value={settings?.input2MaxDecimal || 0} onChange={(e) => onUpdateSettings({ ...(settings || {}), input2MaxDecimal: parseInt(e.target.value, 10) })} style={{ width: "100%" }} />
            <div style={{ fontSize: 12, color: "#6b7280" }}>Current: {settings?.input2MaxDecimal || 0}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Min Value</label>
                <input type="number" value={settings?.input2MinValue || "0"} onChange={(e) => onUpdateSettings({ ...(settings || {}), input2MinValue: e.target.value })} style={propertyStyles.inputSmall} placeholder="0" />
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>*Based on table values</div>
              </div>
              <div>
                <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Max Value</label>
                <input type="number" value={settings?.input2MaxValue || "10000"} onChange={(e) => onUpdateSettings({ ...(settings || {}), input2MaxValue: e.target.value })} style={propertyStyles.inputSmall} placeholder="10000" />
              </div>
            </div>
          </div>
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
    tableData = null } = component;

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
        <span style={{ color: "#dc2626", marginLeft: 6 }}>
          *
        </span>}
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
        <div style={{
          width: "100%", 
          minHeight: compStyles?.height || "80px",
          background: compStyles?.bgColor || "#fff",
          border: `${compStyles?.borderWidth || "1px"} solid ${compStyles?.borderColor || "#e5e7eb"}`,
          borderRadius: compStyles?.borderRadius || "6px",
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          gap: 8,
          padding: 12
        }}>
          <div style={{ fontSize: 32 }}>📤</div>
          <div style={{ fontSize: 14, color: "#6b7280", textAlign: "center" }}>
            <strong>Click to upload</strong> or drag and drop
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
        {renderLabel(label)}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            disabled={!preview}
            style={{
              padding: "8px 12px", 
              background: buttonStyle?.bgColor || "#000", 
              color: buttonStyle?.textColor || "#fff", 
              borderRadius: 6,
              border: "none",
              cursor: preview ? "pointer" : "not-allowed",
              opacity: preview ? 1 : 0.7
            }}
          >
            {buttonStyle?.buttonText || "Edit"}
          </button>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Upload & edit photo</div>
        </div>
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
          <div>
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
          </div>
          {tableData && !preview && (
            <div style={{
              padding: 8, 
              background: "#ecfdf5", 
              border: "1px solid #6ee7b7", 
              borderRadius: 4, 
              fontSize: 12, 
              color: "#065f46" 
          }}>
              ✓ Table data loaded: {tableData.fileName} ({tableData.data?.length || 0} rows)
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
    background: "#f9f1fb",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
  },

  topBar: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
  },

  backBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
  },

  formNameInput: {
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
  },

  smallBtn: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    background: "#fff",
  },

  primaryBtn: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: "#0ea5a4",
    color: "#fff",
  },

  editorContainer: {
    display: "flex",
    flex: 1,
    height: "calc(100% - 64px)",
    overflow: "hidden",
  },

  canvasArea: {
    flex: 3,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    marginRight: 16,
    padding: 16,
  },

  canvasScrollableContent: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: 12,
    background: "#ffffff",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    marginBottom: 12,
  },

  canvasSectionTabsContainer: {
    flex: "0 0 auto",
    borderTop: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 8,
    maxHeight: "200px",
    minHeight: "150px",
    overflowY: "auto",
  },

  dropZonePlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    minHeight: 500,
  },

  componentWrapper: {
    padding: 12,
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    position: "relative",
    marginBottom: 8,
  },

  componentWrapperSelected: {
    boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
    borderColor: "#3b82f6",
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

  sidebar: {
    width: 360,
    borderLeft: "1px solid #e5e7eb",
    padding: 12,
    background: "#f8fafc",
  },

  sidebarTabs: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },

  tabButton: {
    padding: "8px 10px",
    borderRadius: 6,
    background: "#fff",
    border: "1px solid #e5e7eb",
    cursor: "pointer",
  },

  tabButtonActive: {
    background: "#eef2ff",
    borderColor: "#c7d2fe",
  },

  tabButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  sidebarContent: {
    height: "calc(100% - 56px)",
    overflowY: "auto",
  },
};

// ==================== PROPERTY STYLES ====================
const propertyStyles = {
  sectionWhite: {
    padding: 12,
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 8,
    borderRadius: 6,
  },

  sectionBlue: {
    padding: 12,
    background: "#eff6ff",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 8,
    borderRadius: 6,
  },

  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
  },

  labelSmall: {
    display: "block",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 500,
    color: "#374151",
  },

  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
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


{/*
1. compStyles - The component's styles object
2. onUpdateStyle - Function to update styles
3. showAlignment (boolean) - Show/hide text alignment controls
4. showColors (boolean) - Show/hide color controls
5. showSpacing (boolean) - Show/hide spacing controls
6. fontSizeRange (object) - { min: number, max: number }
7. labelPrefix (string) - Text to prefix before "Typography" (e.g., "Body ", "Heading ")  
  
*/}