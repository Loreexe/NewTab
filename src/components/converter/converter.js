document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const categorySelect = document.getElementById('converter-category');
    const input1 = document.getElementById('converter-val-1');
    const input2 = document.getElementById('converter-val-2');
    const unit1Select = document.getElementById('converter-unit-1');
    const unit2Select = document.getElementById('converter-unit-2');

    // Unit definition maps
    const unitsMap = {
        length: {
            'm': { label: 'Metri (m)', rate: 1 },
            'km': { label: 'Chilometri (km)', rate: 1000 },
            'cm': { label: 'Centimetri (cm)', rate: 0.01 },
            'mm': { label: 'Millimetri (mm)', rate: 0.001 },
            'mi': { label: 'Miglia (mi)', rate: 1609.344 },
            'yd': { label: 'Yarde (yd)', rate: 0.9144 },
            'ft': { label: 'Piedi (ft)', rate: 0.3048 },
            'in': { label: 'Pollici (in)', rate: 0.0254 }
        },
        weight: {
            'g': { label: 'Grammi (g)', rate: 1 },
            'kg': { label: 'Chilogrammi (kg)', rate: 1000 },
            'lb': { label: 'Libbre (lb)', rate: 453.59237 },
            'oz': { label: 'Once (oz)', rate: 28.349523125 }
        },
        temperature: {
            'C': { label: 'Celsius (°C)', isTemp: true },
            'F': { label: 'Fahrenheit (°F)', isTemp: true },
            'K': { label: 'Kelvin (K)', isTemp: true }
        },
        volume: {
            'l': { label: 'Litri (l)', rate: 1 },
            'ml': { label: 'Millilitri (ml)', rate: 0.001 },
            'gal': { label: 'Galloni (gal)', rate: 3.78541 },
            'cup': { label: 'Tazze (cup)', rate: 0.236588 }
        }
    };

    // Populate unit select boxes based on chosen category
    function populateUnits() {
        if (!categorySelect || !unit1Select || !unit2Select) return;
        const category = categorySelect.value;
        const units = unitsMap[category];

        // Remember previously selected units if they exist in the new category
        const prev1 = unit1Select.value;
        const prev2 = unit2Select.value;

        unit1Select.innerHTML = '';
        unit2Select.innerHTML = '';

        Object.keys(units).forEach(key => {
            const opt1 = document.createElement('option');
            opt1.value = key;
            opt1.textContent = units[key].label;
            unit1Select.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = key;
            opt2.textContent = units[key].label;
            unit2Select.appendChild(opt2);
        });

        // Set default selection (first and second item)
        const unitKeys = Object.keys(units);
        if (unitKeys.length >= 2) {
            unit1Select.value = unitKeys[0];
            unit2Select.value = unitKeys[1];
        }

        // Run initial conversion
        convert(1);
    }

    // Conversion calculation logic
    function convert(direction) {
        if (!categorySelect || !input1 || !input2 || !unit1Select || !unit2Select) return;
        
        const category = categorySelect.value;
        const u1 = unit1Select.value;
        const u2 = unit2Select.value;
        
        const units = unitsMap[category];
        
        if (direction === 1) {
            // Convert Input 1 to Input 2
            const val = parseFloat(input1.value);
            if (isNaN(val)) {
                input2.value = '';
                return;
            }

            if (category === 'temperature') {
                input2.value = convertTemp(val, u1, u2).toFixed(2);
            } else {
                // Convert to base rate (meters, grams, liters) then convert to target
                const valInBase = val * units[u1].rate;
                const targetVal = valInBase / units[u2].rate;
                input2.value = formatResult(targetVal);
            }
        } else {
            // Convert Input 2 to Input 1
            const val = parseFloat(input2.value);
            if (isNaN(val)) {
                input1.value = '';
                return;
            }

            if (category === 'temperature') {
                input1.value = convertTemp(val, u2, u1).toFixed(2);
            } else {
                // Convert to base rate then convert to target
                const valInBase = val * units[u2].rate;
                const targetVal = valInBase / units[u1].rate;
                input1.value = formatResult(targetVal);
            }
        }
    }

    // Helper: format small/large floating numbers cleanly
    function formatResult(val) {
        if (val === 0) return 0;
        if (Math.abs(val) < 0.0001 || Math.abs(val) >= 1e9) return val.toExponential(4);
        return parseFloat(val.toFixed(4)).toString();
    }

    // Helper: Temperature conversions
    function convertTemp(val, fromUnit, toUnit) {
        if (fromUnit === toUnit) return val;
        
        let celsius = 0;
        
        // Convert to Celsius first
        if (fromUnit === 'C') celsius = val;
        else if (fromUnit === 'F') celsius = (val - 32) * 5/9;
        else if (fromUnit === 'K') celsius = val - 273.15;
        
        // Convert Celsius to target unit
        if (toUnit === 'C') return celsius;
        else if (toUnit === 'F') return (celsius * 9/5) + 32;
        else if (toUnit === 'K') return celsius + 273.15;
        
        return val;
    }

    // Listeners
    if (categorySelect) {
        categorySelect.addEventListener('change', populateUnits);
    }
    
    if (input1) {
        input1.addEventListener('input', () => convert(1));
    }
    if (input2) {
        input2.addEventListener('input', () => convert(2));
    }
    
    if (unit1Select) {
        unit1Select.addEventListener('change', () => convert(1));
    }
    if (unit2Select) {
        unit2Select.addEventListener('change', () => convert(1));
    }

    // Initial setup
    populateUnits();
});
