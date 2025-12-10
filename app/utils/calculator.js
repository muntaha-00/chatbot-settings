//shared calculator engine- used in both preview and storefront

export class CalculatorEngine {
    constructor(components, formulaSettings){
        this.components = components;
        this.formulaSettings = formulaSettings;
    }

    //get the calculated value for a specific element

    getElementValue(elementId, formValues){
        const component = this.components.find(c => c.id === elementId);
        if (!component) return 0;

        const value = formValues[elementId];

        //handle conditional display
        if (component.conditionalDisplay?.enabled) {
            const isVisible = this.isElementVisible(component, formValues);
            if (!isVisible) {
                return parseFloat(component.conditionalDisplay.valueWhenNotDisplayed || 1);
            }
        }

        //route to appropriate handler based on element type

       switch (component.type) {
            case "number_input":
                return this.handleNumberInput(component, value);
            
            case "dropdown":
            case "radio":
            case "image_selector":
                return this.handleSelection(component, value);
            
            case "checkbox":
                return this.handleCheckbox(component, value);
            
            case "calculation_display":
                return this.evaluateFormula(component.settings?.formula || "", formValues);
            
            case "data_lookup":
                return this.handleDataLookup(component, formValues);
            
            default:
                return parseFloat(value) || 0;
        }
    }

    //handle number input with optional value ranges(bulk pricing)

    handleNumberInput(component, value) {
        const numValue = parseFloat(value) || 0;
        const settings = component.settings || {};

        // Check if value ranges are enabled for bulk pricing
        if (settings.valueRangeEnabled && component.valueRanges?.length > 0) {
        for (const range of component.valueRanges) {
            const start = parseFloat(range.start) || 0;
            const end = parseFloat(range.end) || 0;
            
            if (numValue >= start && numValue <= end) {
            return parseFloat(range.value) || 0;
            }
        }
        }

        return numValue;
    }

    //handle dropdown, radio button and image selector selections

    handleSelection(component, value) {
        const options = component.options || [];
        const selectedOption = options.find(opt => opt.id === value || opt.name === value);
        return parseFloat(selectedOption?.value || 0);
    }

    //handle checkbox(both single and multiple selection)
    handleCheckbox(component, value) {
        const settings = component.settings || {};
        
        if (settings.multipleSelection) {
        // Multiple checkboxes - sum all checked values
        if (!Array.isArray(value)) return 0;
        
        return value.reduce((sum, selectedId) => {
            const option = component.options?.find(opt => opt.id === selectedId);
            return sum + (parseFloat(option?.value) || 0);
        }, 0);
        } else {
        // Single checkbox - return checked or unchecked value
        return value 
            ? parseFloat(settings.checkedValue || 0) 
            : parseFloat(settings.unCheckedValue || 0);
        }
    }

    //handle sata lookup from excel sheet
    handleDataLookup(component, formValues) {
        const tableData = component.tableData?.data;
        if (!tableData || tableData.length === 0) return 0;

        const settings = component.settings || {};
        let input1Value, input2Value;

        // Get input 1 value (from formula or direct input)
        if (settings.input1Formula) {
        input1Value = this.evaluateFormula(settings.input1FormulaText || "", formValues);
        } else {
        input1Value = parseFloat(formValues[`${component.id}_input1`]) || 0;
        }

        // Get input 2 value (from formula or direct input)
        if (settings.input2Formula) {
        input2Value = this.evaluateFormula(settings.input2FormulaText || "", formValues);
        } else {
        input2Value = parseFloat(formValues[`${component.id}_input2`]) || 0;
        }

        // Apply decimal limits
        input1Value = this.applyDecimal(input1Value, settings.input1MaxDecimal || 0);
        input2Value = this.applyDecimal(input2Value, settings.input2MaxDecimal || 0);

        // Lookup value in table
        const headers = component.tableData?.headers || [];
        const row = tableData.find(r => {
        const col1 = parseFloat(r[headers[0]]) || 0;
        const col2 = parseFloat(r[headers[1]]) || 0;
        return col1 === input1Value && col2 === input2Value;
        });

        // Return value from third column (or first available)
        return row ? parseFloat(row[headers[2]] || row[headers[0]] || 0) : 0;
    }

    //check if an element should be visible based on conditional display rules
    isElementVisible(component, formValues) {
        const cd = component.conditionalDisplay;
        if (!cd?.enabled || !cd.triggerElementId) return true;

        const triggerElement = this.components.find(c => c.id === cd.triggerElementId);
        if (!triggerElement || triggerElement.type !== "image_selector") return true;

        // Check if a value is selected in the trigger element
        const selectedValue = formValues[cd.triggerElementId];
        return !!selectedValue;
    }

    //evaluate formula with element reference
    evaluateFormula(formula, formValues) {
        if (!formula) return 0;

        try {
            let processedFormula = formula;

            //replace [element_n] with actunal values
            const elementRefs = formula.match(/\[element_(\d+)\]/g) || [];

            elementRefs.forEach(ref => {
                const indexMatch = ref.match(/\[element_(\d+)\]/);
                if(indexMatch){
                    const index = parseInt(indexMatch[1])-1; //convert to 0-based index

                    if (index >= 0 && index < this.components.length) {
                        const component = this.components[index];
                        const value = this.getElementValue(component.id, formValues);
                        processedFormula = processedFormula.replace(ref, value.toString());
                    }
                }
            });

            //evaluate the mathematical expression

            const result = new Function(`'use strict'; return (${processedFormula})`)();
            return parseFloat(result) || 0;
        } catch (error){
            console.error("Formula evaluation error:", error, "Formula:", formula);
            return 0;
        }
    }

    //calculate final price from main formula
    calculateFinalPrice(formValues) {
        const formula = this.formulaSettings.formula;
        if (!formula) return 0;

        const result = this.evaluateFormula(formula, formValues);
        const decimals = parseInt(this.formulaSettings.formulaDecimals) || 2;
        const minValue = parseFloat(this.formulaSettings.minFormulaValue) || 0;

        const finalValue = Math.max(result, minValue);
        return this.applyDecimal(finalValue, decimals);
    }

    //format price with prefix/suffix
    formatPrice(price) {
        const prefix = this.formulaSettings.formulaPrefix || "";
        const suffix = this.formulaSettings.formulaSuffix || "";
        const decimals = parseInt(this.formulaSettings.formulaDecimals) || 2;
        
        return `${prefix}${price.toFixed(decimals)}${suffix}`;
    }

    //apply decimal
    appleDecimal(value, decimals){
        return parseFloat(value, toFixed(decimals));
    }

    //get quantity for cart(from useAsQuantity elements)
    getCartQuantity(formValues) {
        // Find first element marked as "useAsQuantity"
        const quantityElement = this.components.find(c => 
        (c.type === "number_input" || c.type === "calculation_display") &&
        c.settings?.useAsQuantity
        );

        if (!quantityElement) return 1; // Default quantity

        const value = this.getElementValue(quantityElement.id, formValues);
        return Math.max(1, Math.floor(value)); // Ensure at least 1
    }
    
}

//export helper function to create calculator engine
export function createCalculator(components, formulaSettings) {
  return new CalculatorEngine(components, formulaSettings);
}