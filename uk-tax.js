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

    // Annualised 2026/27 Class 1 employee rates, standard category A.
    function employeeNationalInsurance(annualPay) {
        const main = Math.max(0, Math.min(annualPay, 50270) - 12570);
        const upper = Math.max(0, annualPay - 50270);
        return main * 0.08 + upper * 0.02;
    }

    function estimateGrossMonthly(netMonthly, region, people) {
        if (netMonthly <= 0) return 0;
        const target = netMonthly * 12 / people;
        let low = target;
        let high = target / 0.25;
        for (let i = 0; i < 48; i++) {
            const gross = (low + high) / 2;
            const takeHome = gross - incomeTax(gross, region) - employeeNationalInsurance(gross);
            if (takeHome < target) low = gross;
            else high = gross;
        }
        return high * people / 12;
    }

    return Object.freeze({ incomeTax, incrementalMonthlyTax, employeeNationalInsurance, estimateGrossMonthly });
})();

if (typeof module !== 'undefined') module.exports = UKTax;
