import { json } from "../utils/response.js";
import prisma from "../db.server";

// safe JSON parse helper
function safeJSONParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    console.error("JSON parse error:", e);
    return fallback;
  }
}

// get : fetch form by ID for public display
export async function loader({ request, params }) {
  const formId = params["*"];
  
  if (!formId) {
    return json({ error: "Form ID required" }, { status: 400 });
  }

  try {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!form) {
      return json({ error: "Form not found" }, { status: 404 });
    }

    if (!form.isActive) {
      return json({ error: "Form is not active" }, { status: 403 });
    }

    // Parse options (styles) and metadata for each field
    const formWithParsedFields = {
      ...form,
      fields: form.fields.map((field) => {
        const parsedOptions = safeJSONParse(field.options, {});
        const parsedMetadata = safeJSONParse(field.metadata, {});
        
        return {
          ...field,
          options: parsedOptions,  // This is styles
          metadata: parsedMetadata, // This contains everything else
          // For backward compatibility, extract common metadata fields
          tooltip: parsedMetadata.tooltip,
          settings: parsedMetadata.settings,
          conditionalDisplay: parsedMetadata.conditionalDisplay,
        };
      }),
      // Parse canvas settings
      formulaSettings: safeJSONParse(form.formulaSettings, null),
      productSettings: safeJSONParse(form.productSettings, null),
      nonProductSettings: safeJSONParse(form.nonProductSettings, null),
      advancedSettings: safeJSONParse(form.advancedSettings, null),
    };

    return json({ form: formWithParsedFields });
  } catch (error) {
    console.error("Error fetching form:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Submit form data 
export async function action({ request, params }) {
  const formId = params["*"];
  
  if (!formId) {
    return json({ error: "Form ID required" }, { status: 400 });
  }

  try {
    const data = await request.json();
    
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!form) {
      return json({ error: "Form not found" }, { status: 404 });
    }

    if (!form.isActive) {
      return json({ error: "Form is not active" }, { status: 403 });
    }

    // Validate required fields
    const errors = {};
    for (const field of form.fields) {
      if (field.required && !data[field.id]) {
        errors[field.id] = `${field.label} is required`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return json({ success: false, errors }, { status: 400 });
    }

    // Save submission
    await prisma.formSubmission.create({
      data: {
        formId,
        shop: form.shop,
        data: JSON.stringify(data),
      },
    });

    return json({ 
      success: true, 
      message: "Form submitted successfully" 
    });
  } catch (error) {
    console.error("Error submitting form:", error);
    return json({ 
      error: "Failed to submit form",
      success: false 
    }, { status: 500 });
  }
}