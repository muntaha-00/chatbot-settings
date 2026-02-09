//calculator.js handle all calculation logic for forms
//processes form values and returns results


import * as math from 'mathjs';



export class CalculatorEngine {
    constructor(components, formulaSettings){
        this.components = components;
        //store all form elements
        //array of component objects with their settings

        this.formulaSettings = formulaSettings;
        //store main formula configuration
        //object with formula, prefix, suffix, decimals, etc
    }

    //Convert {Label} syntax to element_X format
    //this allows users to write {Size} instead of element_3
    convertLabelSyntaxToElementIds(formula) {
        if (!formula) return "";
        
        let convertedFormula = formula;
        
        // Match {anything} or {anything_qty}
        const labelRefs = formula.match(/\{([^}]+)\}/g) || [];
        
        console.log("Converting label syntax:", {
            originalFormula: formula,
            foundLabels: labelRefs
        });
        
        labelRefs.forEach(labelRef => {
            // Extract the label name (remove { and })
            const fullMatch = labelRef.slice(1, -1); // Remove { and }
            
            // Check if it has _qty suffix
            const isQty = fullMatch.endsWith('_qty');
            const labelName = isQty ? fullMatch.slice(0, -4) : fullMatch;
            
            console.log(`  Looking for: "${labelName}"`, isQty ? "(quantity)" : "");
            
            // Find component by label (case-insensitive, trim whitespace)
            const component = this.components.find(c => 
                c.label?.trim().toLowerCase() === labelName.trim().toLowerCase()
            );
            
            if (component) {
                // Find the index (1-based) in the components array
                const index = this.components.indexOf(component) + 1;
                const replacement = isQty ? `[element_${index}_qty]` : `[element_${index}]`;
                
                console.log(`Found: ${component.label} → ${replacement}`);
                
                // Replace this specific occurrence
                convertedFormula = convertedFormula.replace(labelRef, replacement);
            } else {
                console.warn(`Not found: ${labelName}`);
            }
        });
        
        console.log("Converted formula:", convertedFormula);
        return convertedFormula;
    }
    
    //NEW: Convert element_X format back to {Label} syntax for display
    //this shows users readable formulas when editing
    convertElementIdsToLabelSyntax(formula) {
        if (!formula) return "";
        
        let convertedFormula = formula;
        
        // Match [element_X] and [element_X_qty]
        const elementRefs = formula.match(/\[element_(\d+)(?:_qty)?\]/g) || [];
        
        console.log("Converting to labels:", {
            originalFormula: formula,
            foundElements: elementRefs
        });
        
        elementRefs.forEach(elementRef => {
            const match = elementRef.match(/\[element_(\d+)((?:_qty)?)\]/);
            if (match) {
                const index = parseInt(match[1]) - 1;
                const isQty = match[2] === '_qty';
                
                if (index >= 0 && index < this.components.length) {
                    const component = this.components[index];
                    const label = component.label || `Element ${index + 1}`;
                    const replacement = isQty ? `{${label}_qty}` : `{${label}}`;
                    
                    console.log(`  ${elementRef} → ${replacement}`);
                    convertedFormula = convertedFormula.replace(elementRef, replacement);
                }
            }
        });
        
        console.log("Converted to labels:", convertedFormula);
        return convertedFormula;
    }

    //function for get element value
    //for calculated value for any element
    //this is called for every element referenced in formula

    getElementValue(elementId, formValues){
        const component = this.components.find(c=>c.id === elementId);
        //find component by it's id
        //search components array for matching id

        if(!component) return 0;
        //if element not found use 0

        const value = formValues[elementId];
        //get user-entered or calculated value
        //look up in formvalues object

        //==========conditional value check===========
        //handle elements that can be hidden

        if(component.conditionalDisplay?.enabled){
            const isVisible = this.isElementVisible(component, formValues);
            //check if element should be visible
            //based on trigger element selection

            if(!isVisible){
                return parseFloat(component.conditionalDisplay.valueWhenNotDisplayed || 1);
                //use fallback value when hidden
                //prevents breaking formulas when element hidden
            }
        }

        //route to type-specific handler
        //different element types have different value calculation logic
        switch(component.type){
            case "number_input":
                return this.handleNumberInput(component, value);
                //may have value ranges(bulk pricing)

            case "dropdown":
            case "radio":
            case "image_selector":
                return this.handleSelection(component, value);
                //convert selection id to numeric value
            case "checkbox":
                return this.handleCheckbox(component, value);
                //single vs multiplle checkboxes
            case "calculation_display":
                return this.evaluateFormula(component.settings?.formula || "", formValues);
                //calculate from formula
            case "data_lookup":
                return this.handleDataLookup(component, formValues);
                //look up values from table
            case "text_input":
                return this.handleTextInput(component, value);
                //handle text input with validation
            default: 
                return parseFloat(value) || 0;
                //fallback for simple numberic values
        }

    }

    //text input handler
    //handle text input with validation for min/max characters
    handleTextInput(component, value){
        const settings = component.settings || {};
        const textValue = value ? String(value) : "";
        
        //calculate text length based on settings
        const includeSpace = settings.includeSpaceInLength !== false; //default true
        let textLength = textValue.length;
        
        if(!includeSpace){
            //exclude spaces from length calculation
            textLength = textValue.replace(/\s/g, "").length;
        }
        
        //check character limits
        const minChars = parseInt(settings.minCharacters) || 0;
        const maxChars = parseInt(settings.maxCharacters) || Infinity;
        
        console.log("Text input validation:", {
            value: textValue,
            textLength: textLength,
            minChars: minChars,
            maxChars: maxChars,
            valid: textLength >= minChars && textLength <= maxChars
        });
        
        //return 1 if valid, 0 if invalid (for use in formulas)
        if(textLength < minChars || textLength > maxChars){
            return 0; //invalid
        }
        
        return 1; //returns 1 for valid text
    }


    //numberic input handler
    //handle number inputs with optional value ranges(bulk pricing)
    handleNumberInput(component, value){
    const numValue = parseFloat(value) || 0;
    const settings = component.settings || {};

    //check if value ranges(bulk pricing) enabled
    if(settings.valueRangeEnabled && component.valueRanges?.length > 0){
        //use different values based on input range
        //1-10 units = $10 each, 11-50 = $8 each

        for (const range of component.valueRanges){
        const start = parseFloat(range.start) || 0;
        const end = parseFloat(range.end) || 0;

        if(numValue >= start && numValue <= end){
            // Return the range VALUE, not the input
            // This is used for DISCOUNT MULTIPLIERS or BULK PRICING
            const rangeValue = parseFloat(range.value) || 0;
            
            console.log(`Value Range Match:`, {
            inputValue: numValue,
            rangeStart: start,
            rangeEnd: end,
            rangeValue: rangeValue,
            component: component.label
            });
            
            return rangeValue;
            //return range value instead of input
            //input 25 (in range 11-50) returns 8
        }
        }
        
        // If value ranges enabled but no range matches, return 0
        console.warn(`No value range match for ${numValue} in ${component.label}`);
        return 0;
    }

    return numValue;
    //no ranges, use actual input value
    }

    //get raw number input (ignoring value ranges)
    //used when we need the actual input number (like quantity)
    //even if value ranges are enabled for that element
    getRawNumberInput(component, value){
    const numValue = parseFloat(value) || 0;
    return numValue;
    //always return the actual input, ignore value ranges
    }

    //selection handler
    //convert dropdown/radio/image selector selection to number

    handleSelection(component, value){
        const options = component.options || [];
        // normalize value to string for comparisons
        const valStr = value === undefined || value === null ? "" : String(value);

        // match by id, name or option.value (handle numeric/string ids)
        const selectedOption = options.find(opt =>
            String(opt.id) === valStr || String(opt.name) === valStr || String(opt.value) === valStr
        );

        return parseFloat(selectedOption?.value || 0);
        //extract numeric value from option
    }

    //checkbox handler
    //handle single checkbox or multiple checkboxes

    handleCheckbox(component, value){
        const settings = component.settings || {};
        if(settings.multipleSelection){
            //sum all checked values

            if(!Array.isArray(value)) return 0;
            //value should be array

            return value.reduce((sum, selectedId) => {
                const idStr = String(selectedId);
                const option = component.options?.find(opt => String(opt.id) === idStr || String(opt.value) === idStr);
                return sum + (parseFloat(option?.value) || 0);
            }, 0);

        } else {
            //single selection
            //convert value to number and check if it equals checkedValue

            if (value === undefined || value === null || value === "") return 0;
            const checkedValue = parseFloat(component.checkedValue) || 0;
            const isChecked = value === component.checkedValue || 
                            value === true || 
                            value === "true" || 
                            value === 1;

            return isChecked ? checkedValue : 0;
            //return checked value if checked otherwise 0
        }
    }

    //data lookup handler
    //look up values from uploaded table

    handleDataLookup(component, formValues){
        const settings = component.settings || {};

        //check if lookup is configured
        if(!settings.lookupTableEnabled || !component.lookupTable?.length){
            return 0;
        }

        //identify the lookup key elements (the elements user inputs to search)
        //these are the elements whose values will be used to find matching row
        const lookupKeyElements = this.components.filter(c => 
            c.settings?.isLookupKey && c.id !== component.id
        );

        if(lookupKeyElements.length === 0){
            console.warn("No lookup key elements found");
            return 0;
        }

        //get the values of lookup key elements from user input
        const lookupValues = lookupKeyElements.map(elem => {
            const value = formValues[elem.id];
            return value !== undefined && value !== null ? String(value).toLowerCase().trim() : "";
        });

        console.log("Looking up:", {
            lookupKeys: lookupKeyElements.map(e => e.label),
            lookupValues: lookupValues,
            tableSize: component.lookupTable.length
        });

        //find matching row in the lookup table
        const matchingRow = component.lookupTable.find(row => {
            //each row has values in same order as elements
            const rowLookupValues = lookupKeyElements.map((elem, idx) => {
                const cellValue = row[idx];
                return cellValue !== undefined && cellValue !== null ? String(cellValue).toLowerCase().trim() : "";
            });

            //all lookup values must match for this row to be selected
            const isMatch = lookupValues.every((val, idx) => val === rowLookupValues[idx]);

            if(isMatch){
                console.log("Found matching row:", row);
            }

            return isMatch;
        });

        if(!matchingRow){
            console.warn("No matching row found in lookup table");
            return parseFloat(settings.defaultLookupValue) || 0;
        }

        //extract the value from the data lookup element's column
        //find which column corresponds to this data lookup element
        const thisElementIndex = this.components.findIndex(c => c.id === component.id);
        const value = matchingRow[thisElementIndex];

        console.log("Lookup result:", {
            rowData: matchingRow,
            elementColumn: thisElementIndex,
            returnValue: value
        });

        return parseFloat(value) || 0;
    }

    //conditional display helper
    //check if element should be visible based on trigger

    isElementVisible(component, formValues){
        const condition = component.conditionalDisplay;
        if(!condition?.enabled) return true;
        //if not enabled, always visible

        //handle deprecated showIfEqual condition
        //old version used showIfEqual field
        if(condition.showIfEqual !== undefined){
            const triggerValue = formValues[condition.triggerElement];
            const isVisible = triggerValue === condition.showIfEqual;

            console.log("Conditional Display (legacy):", {
                element: component.label,
                triggerValue,
                shouldEqual: condition.showIfEqual,
                isVisible
            });

            return isVisible;
        }

        //new version uses condition type(equals/notEquals)
        const triggerValue = formValues[condition.triggerElement];
        const expectedValue = condition.value;
        const conditionType = condition.condition || "equals";

        let isVisible;
        if(conditionType === "notEquals"){
            isVisible = triggerValue !== expectedValue;
        } else {
            isVisible = triggerValue === expectedValue;
        }

        console.log("Conditional Display:", {
            element: component.label,
            triggerValue,
            expectedValue,
            conditionType,
            isVisible
        });

        return isVisible;
    }


    //formula evaluator
    //evaluate math expression using math.js
    evaluateFormula(formula, formValues){
        try {
            if(!formula || !formula.trim()){
                return 0;
            }

            console.log("\n=== FORMULA EVALUATION ===");
            console.log("Original formula:", formula);

            // NEW: Convert {Label} syntax to [element_X] format first
            let convertedFormula = this.convertLabelSyntaxToElementIds(formula);
            
            //clean formula - remove extra whitespace and line breaks
            const cleanFormula = convertedFormula
                .replace(/\r\n/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            //detect if using brackets [element_X] format
            const hasBrackets = cleanFormula.includes('[element_');

            if(!hasBrackets) {
                // Legacy format without brackets - direct substitution
                console.log("Using legacy format (no brackets)");
                
                const elementRefs = cleanFormula.match(/element_\d+(_qty)?/g) || [];
                console.log("Found element references:", elementRefs);

                let processedFormula = cleanFormula;

                //create scope for variable names
                const scope = {};

                //replace each reference with its value
                elementRefs.forEach(ref => {
                    const parts = ref.split('_');
                    const index = parseInt(parts[1]) - 1;
                    const isQty = parts[2] === 'qty';

                    if(index >= 0 && index < this.components.length){
                        const component = this.components[index];
                        let value;

                        if(isQty){
                            value = this.getRawNumberInput(component, formValues[component.id]);
                        } else {
                            value = this.getElementValue(component.id, formValues);
                        }

                        scope[ref] = value;
                        console.log(`${ref} = ${value} (${component.label})`);
                    }
                });

                console.log("Evaluating:", processedFormula);
                console.log("Variables:", scope);

                const result = math.evaluate(processedFormula, scope);
                console.log("Result:", result);

                return parseFloat(result) || 0;

            } else {
                // Modern format with brackets - must use this for math.js
                console.log("Using bracket format for math.js");
                
                let processedFormula = cleanFormula;
                
                // Match both [element_X] and [element_X_qty]
                const elementRefs = cleanFormula.match(/\[element_(\d+)(?:_qty)?\]/g) || [];

                console.log("MATH.JS FORMULA DEBUG:", {
                    originalFormula: formula,
                    cleanedFormula: cleanFormula,
                    elementRefs: elementRefs
                });

                //create scope object for math.js
                const scope = {};

                // Use a map to track all replacements, then do them all at once
                const replacements = {};

                //collect all element values first
                elementRefs.forEach(ref => {
                    //Capture both element number and optional _qty suffix
                    const indexMatch = ref.match(/\[element_(\d+)((?:_qty)?)\]/);

                    if(indexMatch) {
                        const index = parseInt(indexMatch[1]) - 1;
                        const isQty = indexMatch[2] === '_qty';  // Check if _qty suffix present

                        if(index >= 0 && index < this.components.length){
                            const component = this.components[index];
                            
                            //Handle _qty suffix differently
                            if(isQty){
                                // User wants the RAW quantity value
                                const rawValue = this.getRawNumberInput(component, formValues[component.id]);
                                const varName = `element_${indexMatch[1]}_qty`;
                                scope[varName] = rawValue;
                                
                                // Store replacement for later
                                replacements[ref] = varName;
                                
                                console.log(`  ${varName} = ${rawValue} (actual quantity)`);
                            } else {
                                // Normal element reference
                                const value = this.getElementValue(component.id, formValues);
                                const varName = `element_${indexMatch[1]}`;
                                scope[varName] = value;
                                
                                // Store replacement for later
                                replacements[ref] = varName;
                                
                                // _qty version for number inputs with ranges
                                if(component.type === "number_input" && component.settings?.valueRangeEnabled){
                                    const rawValue = this.getRawNumberInput(component, formValues[component.id]);
                                    scope[`${varName}_qty`] = rawValue;
                                    
                                    console.log(`  ${varName} = ${value} (range value)`);
                                    console.log(`  ${varName}_qty = ${rawValue} (actual quantity) - auto-added`);
                                } else {
                                    console.log(`  ${varName} = ${value} (${component.label})`);
                                }
                            }
                        }
                    }
                });

                // Do all replacements at once, in order from longest to shortest
                // This prevents [element_1] from matching inside [element_10]
                const sortedRefs = Object.keys(replacements).sort((a, b) => b.length - a.length);
                
                sortedRefs.forEach(ref => {
                    // Use split/join to ensure we only replace exact matches
                    processedFormula = processedFormula.split(ref).join(replacements[ref]);
                });

                console.log("Math.js formula:", processedFormula);
                console.log("Variables:", scope);

                //evaluate using math.js
                const result = math.evaluate(processedFormula, scope);

                console.log("Result:", result);

                return parseFloat(result) || 0;
            }
        } catch (error){
            console.error("Math.js Error:", error.message);
            console.error("   Formula:", formula);
            console.error("   Formula length:", formula?.length);
            console.error("   Formula preview:", String(formula).substring(0, 100));
            return 0;
        }
    }


    //calculate final price
    //calculate main form result using main formula
    
    calculateFinalPrice(formValues){
        const formula = this.formulaSettings.formula;
        //get main calculation formula

        if(!formula) return 0;
        //no formula = no price

        const result = this.evaluateFormula(formula, formValues);
        //calculate using emement values

        const decimals = parseInt(this.formulaSettings.formulaDecimals) || 2;
        //how many decimal places to show

        const minValue = parseFloat(this.formulaSettings.minFormulaValue) || 0;
        //floor price - never go below this

        const finalValue = Math.max(result, minValue);
        //apply minimun value constraint
        //if result is 5 but min is 25 return 25

        return this.applyDecimals(finalValue, decimals);
        //round to specified decimal places
    }

    //format price
    //add prefix/suffix to price for display

    formatPrice(price){
        const prefix = this.formulaSettings.formulaPrefix || "";
        const suffix = this.formulaSettings.formulaSuffix || "";
        const decimals = parseInt(this.formulaSettings.formulaDecimals) || 2;

        return `${prefix}${price.toFixed(decimals)}${suffix}`;
        //format as currency or unit
        
    }

    //get cart quantity
//find quantity value for adding to cart
//some forms calculate quantity(e.g., number of boxes needed)

getCartQuantity(formValues){
    //find first element marked as 'useAsQuantity'
    const quantityElement = this.components.find(c => 
        (c.type === "number_input" || c.type === "calculation_display") &&
        c.settings?.useAsQuantity
    );

    //look for element configured as quantity source
    if (!quantityElement) return 1;
    //default to 1 if no quantity field

    //for number inputs with value ranges, get the raw input
    //(the actual number entered, not the range value)
    if(quantityElement.type === "number_input"){
        const value = formValues[quantityElement.id];
        const rawValue = this.getRawNumberInput(quantityElement, value);

        console.log(`🛒 Cart Quantity:`, {
            element: quantityElement.label,
            rawInput: rawValue,
            hasValueRanges: quantityElement.settings?.valueRangeEnabled
        });

        return Math.max(1, Math.floor(rawValue));
        //ensure at least 1, and whole number
    }

    //for calculation displays, use the calculated value
    const value = this.getElementValue(quantityElement.id, formValues);
    return Math.max(1, Math.floor(value));
    //ensure at least 1, and whole number
}

    //dual-purpose number input support
    //get element value for a specific purpose
    //allows getting either the range value or raw value
    //depending on context (formula vs cart quantity)
    getElementValueForPurpose(elementId, formValues, purpose = 'formula'){
        const component = this.components.find(c=>c.id === elementId);
        if(!component) return 0;

        const value = formValues[elementId];

        //for number inputs with value ranges
        if(component.type === "number_input" && component.settings?.valueRangeEnabled){
            if(purpose === 'quantity'){
                //return raw input for quantity purposes
                return this.getRawNumberInput(component, value);
            } else {
                //return range value for formula purposes (discount multiplier)
                return this.handleNumberInput(component, value);
            }
        }

        //for other types, use normal value handling
        return this.getElementValue(elementId, formValues);
    }
    
    //NEW: Helper method for decimal rounding
    applyDecimals(value, decimals) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }
}

//helper function
//create calculation instance easily

export function createCalculator(components, formulaSettings){
    return new CalculatorEngine(components, formulaSettings);
    //convenience function for creating instances
    
}

// NEW: Export utility functions for formula conversion
// These can be used in the UI for real-time conversion

export function convertLabelToElementId(labelFormula, components) {
    // Create a temporary calculator instance to use its conversion method
    const tempCalc = new CalculatorEngine(components, {});
    return tempCalc.convertLabelSyntaxToElementIds(labelFormula);
}

export function convertElementIdToLabel(elementFormula, components) {
    // Create a temporary calculator instance to use its conversion method
    const tempCalc = new CalculatorEngine(components, {});
    return tempCalc.convertElementIdsToLabelSyntax(elementFormula);
}