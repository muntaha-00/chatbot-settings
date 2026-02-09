//calculator.js handle all calculation logic for forms
//processes form values and returns results


export class CalculatorEngine {
    constructor(components, formulaSettings){
        this.components = components;
        //store all form elements
        //array of component objects with their settings

        this.formulaSettings = formulaSettings;
        //store main formula configuration
        //object with formula, prefix, suffix, decimals, etc
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
            default: 
                return parseFloat(value) || 0;
                //fallback for simple numberic values
        }

    }

    //numberic input handler
    //handle number inputs with optional value ranges(bulk pricing)
    handleNumberInput(component, value){
        const numValue = parseFloat(value) || 0;
        //convert string to number, default to 0

        const settings = component.settings || {};

        //check if value ranges(bulk pricing) enabled
        if(settings.valueRangeEnabled && component.valueRanges?.length > 0){
            //use different values based on input range
            //1-10 units = $10 each, 11-50 = $8 each

            for (const range of component.valueRanges){
                const start = parseFloat(range.start) || 0;
                const end = parseFloat(range.end) || 0;

                if(numValue >= start && numValue <= end){
                    return parseFloat(range.value) || 0;
                    //return range value instead of input
                    //input 25 (in range 11-50) returns 8
                }
            }
        }

        return numValue;
        //no ranges, use actual input value
    }

    //selection handler
    //convert dropdown/radio/image selector selection to number

    handleSelection(component, value){
        const options = component.options || [];
        //get list of available options

        const selectedOption = options.find(opt=> opt.id === value || opt.name === value);
        //find selected option by id or name
        //value could be id (from preview) or name(from edit)

        return parseFloat(selectedOption?.value || 0);
        //extract numeric value from option
        //premium option has value 100
    }

    //checkbox handler
    //handle single checkbox or multiple checkboxes

    handleCheckbox(component,value){
        const settings = component.settings || {};
        

        if(settings.multipleSelection) {
            //multiple seletion
            //multiple options can be checked
            //sum all checked vlaues

            if(!Array.isArray(value)) return 0;
            //value should be array

            return value.reduce((sum, selectedId) => {
                const option = component.options?.find(opt => opt.id === selectedId);
                return sum + (parseFloat(option?.value) || 0);
            }, 0);

            //add up all checked option values
            //checked "Express (+10 and "Insurance(+5" = 15
        } else{
            //single checkbox
            //single on/off checkbox
            //return checkedValue or unCheckedValue
            
            return value
            ? parseFloat(settings.checkedValue || 0)
            : parseFloat(settings.unCheckedValue || 0);
            //checked 10, unChecked = 0
        }
    }
    
    //data lookup handler
    //look up value from 20 table based on tewon inputs

    handleDataLookup(component, formValues){
        const tableData = component.tableData;
        //get the lookup tbale

        if(!tableData || !tableData.rows || tableData.rows.length === 0){
            console.warn('Data lookup: No table data available');
                return 0;
                //can't lookup without data
        }

        const settings = component.settings || {};
        let input1Value, input2Value;

        //get inout 1 value
        if(settings.input1Formula){
            input1Value = this.evaluateFormula(settings.input1FormulaText || "", formValues);    
        } else {
            input1Value = parseFloat(formValues[`${component.id}_input1`]) || 0;
        }
    

        //get input 2 value
        if(settings.input2Formula){
            input2Value = this.evaluateFormula(settings.input2FormulaText || "", formValues);
        } else {
            input2Value = parseFloat(formValues[`${component.id}_input2`]) || 0;
        }

        //apply decimal rounding 
        //match table precision

        input1Value = this.applyDecimals(input1Value, settings.input1MaxDecimal || 0);
        input2Value = this.applyDecimals(input2Value, settings.input2MaxDecimal || 0);
        //10.567 with maxDecimal = 1 becomes 10.6

        //perform table lookup
        return this.performLookup(input1Value, input2Value, tableData);
    }

    //table lookup logic
    //find value in 20 table
    //table structure: rows have headers(input 1), columns are input2 values

    performLookup(input1, input2, tableData){
        //need to convert old table format to new format
        //old: {columnHeaders: [], row: [{header, values}]}
        //new:{rows: [{col0, col1, col2,....}]}

        //check if using old format
        if(tableData.columnHeaders && tableData.rows?.[0]?.header !==undefined){
            //old format conversion
            //find row by header(input 1)
            const row = tableData.rows.find(r=>{
                const rowHeader = parseFloat(r.header);
                return Math.abs(rowHeader - input1) < 0.001;
            });

            if(!row){
                console.warn(`No row fornd for input1: ${input1}`);
                return 0;
            }

            //find column index(input 2)
            const colIndex = tableData.columnHeaders.findIndex(header => {
                const colHeader = parseFloat(header);
                return Math.abs(colHeader - input2) < 0.001;
            })

            if(colIndex === -1){
                console.warn(`No column found for input2: ${input2}`);
                return 0;
            }
            return parseFloat(row.values[colIndex] || 0);

        }

        //new format lookup
        const input1Key = 'col0'; //first column = input1
        const input2Key = 'col1'; // second column = input2
        const outputKey = 'col2'; //third column = output value

        //find excat match (with small tolerance for floating point)
        const row = tableData.rows.find(r=> {
            const v1 = parseFloat(r[input1Key] || 0);
            const v2 = parseFloat(r[input2Key] || 0);

            //use tolerance for floating point comparison
            return Math.abs(v1-input1)<0.001 && Math.abs(v2 - input2) < 0.001;
            //floating point numbers are not excat      
        });

        if(row){
            return parseFloat(row[outputKey] || 0);
        }

        //no match found
        console.warn(`No lookup match found for inputs: ${input1}, ${input2}`);
        return 0;
    }

    //apply decimal precision
    // round number to specified decimal places

    applyDecimals(value, decimals){
        return parseFloat(value.toFixed(decimals));
        //toFixed returns string, parseFloat converts back
        //applyDecimals(10.567, 2) = 10.57
    }

    //check element visibility
    //determine if element should be visible based on conditions

    isElementVisible(component, formValues){
        const cd = component.conditionalDisplay;
        //get conditional display settings

        if(!cd?.enabled || !cd.triggerElementId) return true;
        //if not configured, always visible

        const triggerElement = this.components.find(c=> c.id === cd.triggerElementId);
        //find the element that controls visibility

        if(!triggerElement || triggerElement.type !== 'image_selector') return true;
        //only image selectors can trigger(for now)

        //check if a value is selected in the trigger element
        const selectedValue = formValues[cd.triggerElementId];
        return !!selectedValue;
        //visible if trigger has selection, hidden if empty
        //size field only shows when color is selected
    }

    //evaluate formula
    //calculate result from formula string with element references
    //core calculation engine

    evaluateFormula(formula, formValues){
        if(!formula) return 0;
        //empty formula returns 0

        try {
            let processedFormula = formula;
            //will replace [element_n] with actual values

            //find all element references
            //pattern [element_1], [element_2]

            const elementRefs = formula.match(/\[element_(\d+)\]/g) || [];
            //find all [element_n patterns]
            //returns array like ["[element_1]", "[element_2]"]
            
            elementRefs.forEach(ref => {
                const indexMatch = ref.match(/\[element_(\d+)\]/);
        
                 //extract the number from [element_1]

                 if(indexMatch){
                    const index = parseInt(indexMatch[1]) - 1;
                    //convert to 0-based index
                    //[element_1 refers to components[0]]

                    if(index >= 0 && index < this.components.length){
                        const component = this.components[index];
                        const value = this.getElementValue(component.id, formValues);
                        //get calculated value for this element

                        processedFormula = processedFormula.replace(ref, value.toString());
                        //replace [element_1] with actual number
                        //[element_1]*2 become 5*2
                    }
                 }
            });

            //evaluate mathmeticla expression
            // Now have pure math expression like "5 * 2 + 10"
            const result = new Function(`'use strict'; return (${processedFormula})`)();
            //use function constructor to evaluate math
            
            return parseFloat(result) || 0;
            //convert result to number, default to 0 if nam

        } catch(error){
            console.error("Formula evaluation error:", error, "Formula:", formula);
            return 0;
            //return 0 or error instead of crashing
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
        //find first element marked as "useAsQuantity"
        const quantityElement = this.components.find(c=>
        (c.type === "number_input" || c.type === "calculation_display") &&
        c.settings?.useAsQuantity
        );

        //look for element configured as quantity source

        if(!quantityElement) return 1;
        //default to 1 if no quantity field

        const value = this.getElementValue(quantityElement.id, formValues);
        return Math.max(1, Math.floor(value));
        //ensure at least 1, and whole number
    }
}

//helper function
//create calculation instance easily

export function createCalculator(components, formulaSettings){
    return new CalculatorEngine(components, formulaSettings);
    //convenience function for creating instances
    
}




