'use strict';

const UKTax = (() => {
    // 2026/27 non-savings, non-dividend taxable-income bands after allowances.
    const bands = {
        rest: [[37700, 0.20], [125140, 0.40], [Infinity, 0.45]],
        scotland: [[3967, 0.19], [16956, 0.20], [31092, 0.21], [62430, 0.42],
            [125140, 0.45], [Infinity, 0.48]]
    };

    function incomeTax(annualIncome, region) {
        const allowance = Math.max(0, 12570 - Math.max(0, annualIncome - 100000) / 2);
        const taxable = Math.max(0, annualIncome - allowance);
        let previous = 0;
        let tax = 0;
        for (const [upper, rate] of bands[region]) {
            tax += Math.max(0, Math.min(upper, taxable) - previous) * rate;
            if (taxable <= upper) break;
            previous = upper;
        }
        return tax;
    }

    // Annualised run-rate approximation. Earned income is already included in net pay.
    function incrementalMonthlyTax(monthlyIncome, monthlyExtra, region) {
        return (incomeTax((monthlyIncome + monthlyExtra) * 12, region)
            - incomeTax(monthlyIncome * 12, region)) / 12;
    }

    return Object.freeze({ incomeTax, incrementalMonthlyTax });
})();

if (typeof module !== 'undefined') module.exports = UKTax;
