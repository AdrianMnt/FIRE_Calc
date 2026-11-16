'use strict';

const FireModel = ((tax) => {
    const penny = 0.005;
    const simulationSeed = 123456789;
    const months = age => Math.round(age * 12);
    const defaults = Object.freeze({
        currentAge: 35, horizonAge: 95, startingIsa: 40000, startingPension: 60000,
        startingCash: 10000, startingLisa: 0, cashInterest: 0, homeValue: 250000, otherAssets: 0, otherDebt: 0,
        mortgageRemaining: 150000, mortgageBase: 800, mortgageOverpay: 200, estimateMortgagePayment: false,
        mortgageRate: 4, mortgageTerm: 25, redirectMortgage: false,
        mortgageResetMonth: 0, mortgageResetRate: 5, mortgageResetPayment: 0, ukBudgetIncludesMortgage: false,
        annualOverpayRate: 0, firstAnnualOverpayMonth: 12,
        netIncome: 3500, livingExpenses: 1700, monthlyCash: 0, monthlyIsa: 500, workplacePension: 600,
        investUkSurplus: false, linkUkRetirementBudget: false,
        monthlySipp: 0, sippGrossFactor: 1, grossReturn: 7, fees: 0.25, inflation: 2.5,
        targetIncome: 26400, retirementBudgetPeriod: 'annual', minimumRetiredYears: 0, overFundBuffer: 0, pensionAccessAge: 57,
        statePensionAge: 68, statePensionAmount: 0, statePensionPeriod: 'annual', region: 'rest',
        lumpSumAllowance: 268275, lumpSumEnabled: false, lumpSumAmount: 0,
        coastAge: 60, useCoastNet: false, coastNet: 0, coastAfterMortgage: false,
        partTimeNet: 1800, partTimeGross: 2100, estimatePartTimeGross: false, partTimePension: 0,
        usePartTimeBudget: false, partTimeBudget: 2200, partTimeEndAge: 60, partTimeAfterMortgage: false,
        monteCarlo: false, volatility: 15,
        splitHouseholdTax: false, pensionTaxExtra: 0,
        relocate: false, moveAge: 38, replacementHome: 90000, saleHomeValue: 0, saleCosts: 4000,
        purchaseCosts: 3000, movingCosts: 5000, abroadLiving: 1250, abroadRetirement: 15000,
        abroadHealthcare: 150, abroadNetIncome: 2000, abroadCoastNet: 1500, abroadPartTimeNet: 1000,
        abroadInvest: 0, useFixedAbroadInvest: false, saveAbroadSurplusAsCash: false,
        linkAbroadRetirementBudget: false, abroadRetirementBudgetPeriod: 'annual', linkAbroadCoastPay: false,
        abroadPension: 0, abroadPensionTax: 20, abroadStateTax: 20,
        customMilestones: ''
    });

    const exampleDefaults = Object.freeze({
        ...defaults, estimateMortgagePayment: true, estimatePartTimeGross: true, investUkSurplus: true,
        linkUkRetirementBudget: true, linkAbroadRetirementBudget: true, linkAbroadCoastPay: true
    });

    function restoreSettings(saved) {
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...exampleDefaults };
        const restored = { ...defaults, ...saved };
        // Older saved plans contain an explicit post-move contribution. Retain
        // custom amounts and adopt the new automatic mode for the old example amount.
        restored.useFixedAbroadInvest = saved.useFixedAbroadInvest ?? (
            Number.isFinite(saved.abroadInvest) && saved.abroadInvest !== 300
        );
        return restored;
    }

    const annualFactors = Object.freeze({ annual: 1, monthly: 12, weekly: 52 });
    const dependentSettings = Object.freeze({
        mortgageBase: ['estimateMortgagePayment', false],
        mortgageResetRate: ['mortgageResetMonth', true],
        mortgageResetPayment: ['mortgageResetMonth', true],
        firstAnnualOverpayMonth: ['annualOverpayRate', true],
        sippGrossFactor: ['monthlySipp', true],
        targetIncome: ['linkUkRetirementBudget', false],
        retirementBudgetPeriod: ['linkUkRetirementBudget', false],
        statePensionPeriod: ['statePensionAmount', true],
        statePensionAge: ['statePensionAmount', true],
        lumpSumAmount: ['lumpSumEnabled', true],
        coastNet: ['useCoastNet', true],
        partTimeBudget: ['usePartTimeBudget', true],
        partTimeGross: ['estimatePartTimeGross', false],
        abroadRetirement: ['linkAbroadRetirementBudget', false],
        abroadRetirementBudgetPeriod: ['linkAbroadRetirementBudget', false],
        abroadCoastNet: ['linkAbroadCoastPay', false],
        abroadInvest: ['useFixedAbroadInvest', true],
        saveAbroadSurplusAsCash: ['useFixedAbroadInvest', false]
    });

    function settingIsActive(key, getValue) {
        const [driver, active] = dependentSettings[key];
        const value = getValue(driver);
        return (typeof value === 'number' ? value > 0 : value === true) === active;
    }

    function prepare(inputs = {}) {
        const p = { ...defaults, ...inputs };
        if (inputs.useFixedAbroadInvest === undefined && inputs.abroadInvest !== undefined) {
            p.useFixedAbroadInvest = true;
        }
        for (const key of Object.keys(dependentSettings)) {
            if (!settingIsActive(key, driver => p[driver])) p[key] = defaults[key];
        }
        for (const [key, fallback] of Object.entries(defaults)) {
            if (typeof fallback === 'number' && (!Number.isFinite(p[key]) || Math.abs(p[key]) > 1e10)) {
                throw new Error('Enter a valid number for every amount, rate and age.');
            }
        }
        const signed = new Set(['grossReturn', 'inflation', 'netIncome', 'partTimeNet']);
        if (Object.keys(defaults).some(key => typeof p[key] === 'number' && p[key] < 0 && !signed.has(key))) {
            throw new Error('A balance, expense, contribution or age is below zero.');
        }
        if (p.currentAge < 18 || p.horizonAge > 120 || months(p.horizonAge) <= months(p.currentAge)
            || p.coastAge > 120 || p.partTimeEndAge > 120 || p.pensionAccessAge > 120
            || p.statePensionAge > 120 || p.mortgageTerm > 102 || p.minimumRetiredYears > 102) {
            throw new Error('Use ages from 18 to 120 and a horizon after your current age.');
        }
        if (p.grossReturn < -50 || p.grossReturn > 100 || p.inflation < -20 || p.inflation > 100
            || p.fees > 20 || p.cashInterest > 100 || p.mortgageRate > 100 || p.volatility > 100
            || p.overFundBuffer > 100 || p.sippGrossFactor < 1 || p.sippGrossFactor > 2
            || !['rest', 'scotland'].includes(p.region)) {
            throw new Error('Check the tax region and return, inflation, fee and savings rates.');
        }
        if (!Number.isInteger(p.mortgageResetMonth) || p.mortgageResetMonth > 102 * 12 || p.mortgageResetRate > 100) {
            throw new Error('Use a whole number of months to the new mortgage rate, and a rate up to 100%.');
        }
        if (p.annualOverpayRate > 100 || !Number.isInteger(p.firstAnnualOverpayMonth)
            || p.firstAnnualOverpayMonth < 1 || p.firstAnnualOverpayMonth > 102 * 12) {
            throw new Error('Use an annual overpayment percentage up to 100 and a whole number of months until the first payment.');
        }
        if (p.abroadPensionTax > 100 || p.abroadStateTax > 100 || p.pensionTaxExtra > 20) {
            throw new Error('Use effective tax rates up to 100% abroad and a UK pension tax uplift up to 20 points.');
        }
        if (p.estimateMortgagePayment && p.mortgageRemaining > 0 && months(p.mortgageTerm) <= 0) {
            throw new Error('Enter the remaining mortgage term for an estimated payment, or enter the payment yourself.');
        }
        const targets = parseMilestones(p.customMilestones);
        if (p.estimatePartTimeGross) p.partTimeGross = partTimeGrossEstimate(p, p.partTimeNet);
        if (p.partTimeNet > p.partTimeGross) {
            throw new Error('Part-time take-home pay cannot exceed taxable gross pay.');
        }
        const age = months(p.currentAge);
        const duration = months(p.horizonAge) - age;
        const move = p.relocate ? months(p.moveAge) - age : Infinity;
        if (move < 0 || (p.relocate && move >= duration)) {
            throw new Error('Choose a relocation age from your current age to before the planning horizon.');
        }
        const periods = [p.statePensionPeriod, p.retirementBudgetPeriod, p.abroadRetirementBudgetPeriod];
        if (!periods.every(period => Object.hasOwn(annualFactors, period))) {
            throw new Error('Choose a valid period for your budget or pension forecast.');
        }
        p.targetIncome = p.linkUkRetirementBudget ? p.livingExpenses * 12
            : p.targetIncome * annualFactors[p.retirementBudgetPeriod];
        p.abroadRetirement = p.linkAbroadRetirementBudget ? p.abroadLiving * 12
            : p.abroadRetirement * annualFactors[p.abroadRetirementBudgetPeriod];
        p.statePensionAmount *= annualFactors[p.statePensionPeriod];
        // Prepared amounts are annual. Keep them so if a prepared plan is reused.
        p.retirementBudgetPeriod = p.abroadRetirementBudgetPeriod = p.statePensionPeriod = 'annual';
        if (p.linkAbroadCoastPay) p.abroadCoastNet = p.abroadNetIncome;
        if (p.estimateMortgagePayment) {
            p.mortgageBase = amortisedPayment(p.mortgageRemaining, p.mortgageRate / 1200, months(p.mortgageTerm));
        }
        const realGrowth = (1 + p.grossReturn / 100) * (1 - p.fees / 100) / (1 + p.inflation / 100);
        return {
            ...p, age, duration, move, targets, lisaAccess: months(60) - age, realGrowth, monthlyGrowth: realGrowth ** (1 / 12),
            prices: Array.from({ length: duration + 1 }, (_, m) => (1 + p.inflation / 100) ** (m / 12)),
            monthlyCashGrowth: (1 + p.cashInterest / 100) ** (1 / 12),
            minimumRetirement: months(p.minimumRetiredYears),
            access: months(p.pensionAccessAge) - age,
            stateStart: months(p.statePensionAge) - age,
            coastEnd: months(p.coastAge) - age,
            partTimeEnd: months(p.partTimeEndAge) - age,
            maturity: months(p.mortgageTerm) || Infinity
        };
    }

    function initial(p) {
        return {
            isa: p.startingIsa, lisa: p.startingLisa, taxable: 0, home: p.homeValue, cash: p.startingCash, pension: p.startingPension, drawdown: 0,
            mortgage: p.mortgageRemaining, regularPayment: p.mortgageBase, allowance: p.lumpSumAllowance, lumpTaken: false
        };
    }

    function phaseAt(plan, p, m) {
        if (m < plan.start) return 'Working';
        if (plan.mode === 'coast' && m < p.coastEnd) return 'Coasting';
        if (plan.mode === 'partTime' && m < p.partTimeEnd) return 'Part-time';
        return 'Retired';
    }

    function amortisedPayment(balance, rate, term) {
        if (balance === 0) return 0;
        return rate > 0 ? balance * rate / -Math.expm1(-term * Math.log1p(rate)) : balance / term;
    }

    function serviceMortgage(s, p, m, working) {
        const reset = p.mortgageResetMonth > 0 && m >= p.mortgageResetMonth;
        const rate = (reset ? p.mortgageResetRate : p.mortgageRate) / 1200;
        if (reset && m === p.mortgageResetMonth) {
            const term = p.maturity - m;
            if (p.mortgageResetPayment > 0) s.regularPayment = p.mortgageResetPayment;
            else if (Number.isFinite(term) && term > 0) {
                s.regularPayment = amortisedPayment(s.mortgage, rate, term);
            }
        }
        const due = s.mortgage * (1 + rate);
        const scheduled = s.regularPayment + (working ? p.mortgageOverpay : 0);
        const paid = m + 1 >= p.maturity ? due : Math.min(due, scheduled);
        s.mortgage = Math.max(0, due - paid);
        const extra = m + 1 >= p.maturity ? 0 : Math.max(0, paid - s.regularPayment);
        return { paid, extra };
    }

    function householdOutgoings(budget, mortgage, includesMortgage) {
        return includesMortgage ? Math.max(budget, mortgage) : budget + mortgage;
    }

    function takeLumpSum(s, p, price) {
        if (s.lumpTaken || !p.lumpSumEnabled) return;
        s.lumpTaken = true;
        const lump = Math.min(p.lumpSumAmount, s.pension / 4, s.allowance / price);
        s.cash += lump;
        s.pension -= 4 * lump;
        s.drawdown += 3 * lump;
        s.allowance = Math.max(0, s.allowance - lump * price);
    }

    function partTimeGrossEstimate(p, net) {
        return tax.estimateGrossMonthly(net, p.region, p.splitHouseholdTax ? 2 : 1);
    }

    function ukIncomeTax(p, otherTaxable, extra) {
        const people = p.splitHouseholdTax ? 2 : 1;
        return people * tax.incrementalMonthlyTax(otherTaxable / people, extra / people, p.region);
    }

    function spendLiquid(s, amount, lisaAvailable = false) {
        let remaining = amount;
        const accounts = lisaAvailable ? ['cash', 'taxable', 'isa', 'lisa'] : ['cash', 'taxable', 'isa'];
        for (const account of accounts) {
            const drawn = Math.min(s[account], remaining);
            s[account] -= drawn;
            remaining -= drawn;
        }
        return remaining;
    }

    function relocateHome(s, p, price, lisaAvailable) {
        const equity = (p.saleHomeValue || s.home) - s.mortgage / price;
        const costs = p.saleCosts + p.purchaseCosts + p.movingCosts;
        const net = equity - p.replacementHome - costs;
        const available = s.cash + s.taxable + s.isa + (lisaAvailable ? s.lisa : 0);
        const shortfall = Math.max(0, -net - available);
        if (shortfall <= penny) {
            if (net >= 0) s.cash += net;
            else spendLiquid(s, -net, lisaAvailable);
            s.home = p.replacementHome;
            s.mortgage = 0;
        }
        return { equity, costs, net, shortfall, available };
    }

    function drawPension(s, p, price, need, otherTaxable, abroad) {
        const available = s.drawdown + s.pension;
        if (available === 0) return { net: 0, gross: 0, tax: 0 };
        const free = gross => abroad ? 0 : Math.min(Math.max(0, gross - s.drawdown) / 4, s.allowance / price);
        const due = abroad
            ? gross => gross * p.abroadPensionTax / 100
            : gross => ukIncomeTax(p, otherTaxable, gross - free(gross))
                + (gross - free(gross)) * p.pensionTaxExtra / 100;
        if (abroad && p.abroadPensionTax === 100) return { net: 0, gross: 0, tax: 0 };
        // Even the steepest UK taper plus the maximum uplift leaves over 10% net.
        let high = Math.min(available, need / (abroad ? 1 - p.abroadPensionTax / 100 : 0.10));
        let highNet = high - due(high);
        if (highNet > need) {
            let low = need;
            let lowNet = low - due(low);
            if (lowNet >= need) high = low;
            else for (let step = 0; step < 48 && high - low > 1e-8; step++) {
                // Net proceeds are piecewise linear. Interpolation usually solves within
                // one tax band, while periodic bisection keeps convergence across band edges.
                const fraction = (need - lowNet) / (highNet - lowNet);
                const probe = low + (high - low) * (step % 4 === 3 ? 0.5 : fraction);
                const net = probe - due(probe);
                if (Math.abs(net - need) <= 1e-8) {
                    high = probe;
                    break;
                }
                if (net >= need) {
                    high = probe;
                    highNet = net;
                } else {
                    low = probe;
                    lowNet = net;
                }
            }
        }
        const incomeTax = due(high);
        s.allowance = Math.max(0, s.allowance - free(high) * price);
        const crystallised = Math.min(s.drawdown, high);
        s.drawdown -= crystallised;
        s.pension -= high - crystallised;
        return { net: high - incomeTax, gross: high, tax: incomeTax };
    }

    function workingBudget(p, { abroad, working, mortgageCost = 0, extra = 0 }) {
        const cashSaved = working && !abroad ? p.monthlyCash : 0;
        const sippCost = working && !abroad ? p.monthlySipp : 0;
        const pay = abroad ? (working ? p.abroadNetIncome : p.abroadCoastNet)
            : (!working && p.useCoastNet ? p.coastNet : p.netIncome);
        const living = abroad ? p.abroadLiving + p.abroadHealthcare : p.livingExpenses;
        const outgoings = householdOutgoings(living, mortgageCost - extra, !abroad && p.ukBudgetIncludesMortgage) + extra;
        const available = pay - outgoings - sippCost;
        const planned = working ? (abroad ? (p.useFixedAbroadInvest ? p.abroadInvest : 0) : p.monthlyIsa) : 0;
        const remainder = available - cashSaved - planned;
        const automatic = working && (abroad ? !p.useFixedAbroadInvest : p.investUkSurplus)
            ? Math.max(0, remainder) : 0;
        return { pay, outgoings, available, cashSaved, sippCost, planned, remainder, automatic };
    }

    // Month m starts with snapshot m. Cash flows occur first, then growth produces snapshot m+1.
    function advance(s, p, m, phase, growth, buffered) {
        const price = p.prices[m];
        const working = phase === 'Working';
        const abroad = m >= p.move;
        const flow = { phase, abroad, mortgageCost: 0, statePension: 0, tax: 0, drawn: 0,
            shortfall: 0, surplus: 0, isaAdded: 0, investedOutsideIsa: 0, cashSaved: 0,
            annualOverpay: 0, annualOverpayUnfunded: 0 };
        if (m === p.move) {
            flow.relocation = relocateHome(s, p, price, m >= p.lisaAccess);
            if (flow.relocation.shortfall > penny) {
                flow.shortfall = flow.relocation.shortfall;
                return flow;
            }
        }
        const { paid, extra } = serviceMortgage(s, p, m, working);
        const mortgageCost = paid / price;
        flow.mortgageCost = mortgageCost;

        if (working || phase === 'Coasting') {
            const budget = workingBudget(p, { abroad, working, mortgageCost, extra: extra / price });
            flow.availableToSave = budget.available;
            flow.surplus = budget.remainder;
            flow.shortfall = Math.max(0, -flow.surplus);
            if (flow.shortfall <= penny && working) {
                const formerPayment = !abroad && p.mortgageRemaining > 0 && p.redirectMortgage
                    ? Math.max(0, (s.regularPayment + p.mortgageOverpay - paid) / price) : 0;
                const redirected = Math.min(Math.max(0, flow.surplus), formerPayment);
                const automatic = Math.max(0, budget.automatic - redirected);
                const holdCash = abroad && p.saveAbroadSurplusAsCash ? automatic : 0;
                flow.investedOutsideIsa = (abroad ? budget.planned : 0) + automatic - holdCash;
                flow.isaAdded = abroad ? 0 : budget.planned + redirected;
                flow.cashSaved = budget.cashSaved + holdCash;
                s.taxable += flow.investedOutsideIsa;
                s.isa += flow.isaAdded;
                s.cash += flow.cashSaved;
                s.pension += abroad ? p.abroadPension : p.workplacePension + budget.sippCost * p.sippGrossFactor;
                flow.surplus -= redirected + automatic;
            }
        } else {
            const partTime = phase === 'Part-time';
            const taxablePay = partTime ? p.partTimeGross : 0;
            const netPay = partTime ? (abroad ? p.abroadPartTimeNet : p.partTimeNet) : 0;
            const stateGross = m >= p.stateStart ? p.statePensionAmount / 12 : 0;
            flow.statePension = stateGross;
            flow.tax = abroad ? stateGross * p.abroadStateTax / 100 : ukIncomeTax(p, taxablePay, stateGross);
            const ukBudget = partTime && p.usePartTimeBudget ? p.partTimeBudget : p.targetIncome / 12;
            const budget = abroad ? p.abroadRetirement / 12 + p.abroadHealthcare : ukBudget;
            if (partTime && !abroad) s.pension += p.partTimePension;
            const spend = budget * (1 + (buffered ? p.overFundBuffer / 100 : 0));
            const outgoings = householdOutgoings(spend, mortgageCost, !abroad && p.ukBudgetIncludesMortgage);
            let need = outgoings - netPay - stateGross + flow.tax;
            flow.budgetGap = need;
            if (!abroad && m >= p.access) takeLumpSum(s, p, price);

            if (need < 0) {
                // Keep any excess income as cash available for later spending.
                s.cash -= need;
            } else {
                const initialNeed = need;
                need = spendLiquid(s, need, m >= p.lisaAccess);
                flow.drawn = initialNeed - need;
                if (need > penny && m >= p.access) {
                    const pension = drawPension(s, p, price, need, taxablePay + stateGross, abroad);
                    flow.drawn += pension.gross;
                    flow.tax += pension.tax;
                    need -= pension.net;
                }
                flow.shortfall = Math.max(0, need);
            }
        }
        const monthsSinceFirst = m + 1 - p.firstAnnualOverpayMonth;
        if (working && !abroad && flow.shortfall <= penny && p.annualOverpayRate > 0
            && monthsSinceFirst >= 0 && monthsSinceFirst % 12 === 0) {
            // Apply after the regular payment and current month's cash saving.
            const target = s.mortgage / price * p.annualOverpayRate / 100;
            flow.annualOverpay = Math.min(s.cash, target);
            flow.annualOverpayUnfunded = Math.max(0, target - flow.annualOverpay);
            s.cash -= flow.annualOverpay;
            s.mortgage = Math.max(0, s.mortgage - flow.annualOverpay * price);
        }
        s.isa *= growth;
        s.lisa *= growth;
        s.taxable *= growth;
        s.pension *= growth;
        s.drawdown *= growth;
        s.cash *= p.monthlyCashGrowth * price / p.prices[m + 1];
        return flow;
    }

    function snapshot(s, p, m) {
        const pension = s.pension + s.drawdown;
        const mortgage = s.mortgage / p.prices[m];
        const liquid = s.isa + s.cash + s.taxable;
        const accessible = liquid + (m >= p.lisaAccess ? s.lisa : 0);
        const portfolio = liquid + s.lisa + pension;
        const equity = s.home - mortgage;
        const netWorth = portfolio + equity + p.otherAssets - p.otherDebt;
        return { month: m, age: (p.age + m) / 12, isa: s.isa, cash: s.cash,
            pension, lisa: s.lisa, taxable: s.taxable, mortgage, liquid, accessible, portfolio, equity, netWorth };
    }

    function simulate(p, plan, { start = 0, state = initial(p), buffered = false,
        record = false, growthAt = () => p.monthlyGrowth } = {}) {
        const s = { ...state };
        const rows = record ? [snapshot(s, p, start)] : [];
        for (let m = start; m < p.duration; m++) {
            const flow = advance(s, p, m, phaseAt(plan, p, m), growthAt(m), buffered);
            if (record) rows.push({ ...snapshot(s, p, m + 1), ...flow });
            if (flow.shortfall > penny) return { rows, success: false, failureMonth: m + 1,
                relocationShortfall: flow.relocation?.shortfall > penny };
        }
        const success = s.mortgage / p.prices[p.duration] <= penny;
        return { rows, success, failureMonth: success ? null : p.duration, mortgageOutstanding: !success };
    }

    const modes = ['full', 'coast', 'partTime'];

    function partTimeEnabled(p) {
        return p.partTimeNet > 0 || (p.move < p.partTimeEnd && p.abroadPartTimeNet > 0);
    }

    function eligibleUntil(p, mode) {
        const lastFullStart = p.duration - p.minimumRetirement;
        if (mode === 'coast') return p.coastEnd < p.duration && p.coastEnd <= lastFullStart ? p.coastEnd : 0;
        if (mode === 'partTime') {
            return partTimeEnabled(p) && (!p.minimumRetirement || p.partTimeEnd <= lastFullStart)
                ? Math.min(p.duration, p.partTimeEnd) : 0;
        }
        return Math.min(p.duration, lastFullStart + 1);
    }

    function canStart(p, mode, month, mortgage) {
        const mortgageRequired = mode === 'coast' ? p.coastAfterMortgage
            : mode === 'partTime' && p.partTimeAfterMortgage;
        if (mode === 'partTime' && (month < p.move ? p.partTimeNet : p.abroadPartTimeNet) <= 0) return false;
        return month < eligibleUntil(p, mode) && (!mortgageRequired || month === p.move || mortgage / p.prices[month] <= penny);
    }

    function findPlans(p) {
        const plans = { full: null, coast: null, partTime: null };
        const s = initial(p);
        for (let m = 0; m < p.duration; m++) {
            for (const mode of modes) {
                if (plans[mode] || !canStart(p, mode, m, s.mortgage)) continue;
                const plan = { mode, start: m };
                if (simulate(p, plan, { start: m, state: s, buffered: true }).success) plans[mode] = plan;
            }
            if (advance(s, p, m, 'Working', p.monthlyGrowth, false).shortfall > penny) break;
        }
        return plans;
    }

    const milestoneTargets = [10000, 50000, 100000, 250000, 500000, 1000000];

    function parseMilestones(value) {
        if (typeof value !== 'string' || value.length > 200) {
            throw new Error('Enter up to 12 milestone amounts separated by commas.');
        }
        if (!value.trim()) return milestoneTargets;
        const entries = value.split(',').map(entry => entry.trim());
        if (entries.length > 12 || entries.some(entry => !/^\d+(\.\d{1,2})?$/.test(entry)
            || Number(entry) <= 0 || Number(entry) > 1e10)) {
            throw new Error('Enter up to 12 positive milestone amounts separated by commas, without thousands separators.');
        }
        return [...new Set(entries.map(Number))].sort((a, b) => a - b);
    }

    function milestones(rows, targets) {
        const validRows = rows.filter(row => !(row.shortfall > penny));
        return ['accessible', 'pension', 'netWorth'].flatMap(metric => targets.map(target => {
            const first = validRows.find(row => row[metric] >= target);
            return { metric, target, month: first?.month ?? null };
        }));
    }

    // Rolling 12-month deposits in today's pounds. This is a planning flag, not a tax-year calculation.
    function maxAnnualIsaDeposits(rows) {
        let total = 0;
        let largest = 0;
        for (let m = 1; m < rows.length; m++) {
            total += rows[m].isaAdded;
            if (m > 12) total -= rows[m - 12].isaAdded;
            largest = Math.max(largest, total);
        }
        return largest;
    }

    function project(inputs, mode = 'full', startOverride) {
        const p = prepare(inputs);
        const plans = findPlans(p);
        const selected = startOverride === undefined ? plans[mode] ?? null : { mode, start: startOverride };
        const baseline = simulate(p, selected ?? { mode: 'full', start: Infinity }, { record: true });
        const work = advance(initial(p), p, 0, 'Working', p.monthlyGrowth, false);
        const ukWork = p.move === 0 ? advance(initial(p), { ...p, move: Infinity }, 0, 'Working', p.monthlyGrowth, false) : work;
        return { ...projectionDetails(p, selected, baseline), plans, work, ukWork };
    }

    function projectionDetails(p, selected, baseline) {
        return {
            p, selected, baseline, milestones: milestones(baseline.rows, p.targets),
            maxIsaDeposits: maxAnnualIsaDeposits(baseline.rows)
        };
    }

    function compare(inputs) {
        const locations = inputs.relocate ? [false, true] : [false];
        const exitMonth = inputs.relocate ? prepare(inputs).move : null;
        return locations.flatMap(relocate => {
            const p = prepare({ ...inputs, relocate });
            function evaluate(label, assumptions) {
                const plans = findPlans(assumptions);
                const atMove = exitMonth !== null ? simulate(assumptions, { mode: 'full', start: exitMonth },
                    { record: true, buffered: true }) : null;
                const move = atMove?.rows.find(row => row.relocation)?.relocation;
                const failure = atMove?.success === false ? atMove.rows.at(-1) : null;
                return { relocate, label, plans, move, failure,
                    minimumMissed: exitMonth !== null && exitMonth >= eligibleUntil(assumptions, 'full'),
                    mortgageOutstanding: atMove?.mortgageOutstanding };
            }
            const results = [evaluate('Entered return', p)];
            if (p.mortgageRemaining > 0 && (p.mortgageOverpay > 0 || p.annualOverpayRate > 0)) {
                results.push(evaluate('No mortgage overpayment', { ...p, mortgageOverpay: 0, annualOverpayRate: 0 }));
            }
            for (const percent of [3, 4, 6]) {
                const realGrowth = 1 + percent / 100;
                results.push(evaluate(percent + '% real', { ...p, realGrowth, monthlyGrowth: realGrowth ** (1 / 12) }));
            }
            if (p.statePensionAmount > 0) {
                results.push(evaluate('No State Pension', { ...p, statePensionAmount: 0 }));
            }
            const extraTax = relocate ? Math.min(10, 100 - p.abroadPensionTax)
                : Math.min(10, 20 - p.pensionTaxExtra);
            if (extraTax > 0) {
                results.push(evaluate('Private pension tax +' + extraTax + ' pp', {
                    ...p, abroadPensionTax: p.abroadPensionTax + extraTax, pensionTaxExtra: p.pensionTaxExtra + extraTax
                }));
            }
            return results;
        });
    }

    // Compare exact dates, including plans that the earliest-date search cannot fund.
    function decision(inputs, { ukAge, laterUkAge = null, includeRelocation = true, moveAge, lowerPrice, higherPrice,
        realReturn = null }) {
        const base = prepare({ ...inputs, relocate: false });
        const ukStart = decisionMonth(base, ukAge, 'UK part-time');
        const moveStart = includeRelocation ? decisionMonth(base, moveAge, 'relocation') : null;
        const laterUkStart = laterUkAge === null ? ukStart : decisionMonth(base, laterUkAge, 'second UK part-time');
        if (includeRelocation && (![lowerPrice, higherPrice].every(price => Number.isFinite(price)
            && price >= 0 && price <= 1e10) || lowerPrice > higherPrice)) {
            throw new Error('Enter two positive or zero purchase prices, in ascending order.');
        }
        if (realReturn !== null && (!Number.isFinite(realReturn) || realReturn <= -100 || realReturn > 100)) {
            throw new Error('Enter a real return above −100% and up to 100%.');
        }

        function evaluate(p, mode, start) {
            if (realReturn !== null) {
                const realGrowth = 1 + realReturn / 100;
                p = { ...p, realGrowth, monthlyGrowth: realGrowth ** (1 / 12) };
            }
            const plan = { mode, start };
            const run = simulate(p, plan, { record: true, buffered: true });
            const opening = run.rows[start];
            const transition = opening?.shortfall > penny ? undefined : opening;
            const first = run.rows[start + 1];
            const last = run.rows.at(-1);
            const purchase = first?.relocation;
            const failure = !run.success && !run.mortgageOutstanding ? last : null;
            let constraint = null;
            if (transition && mode === 'partTime') {
                if (start >= p.partTimeEnd) constraint = 'partTimeEnd';
                else if (p.partTimeAfterMortgage && transition.mortgage > penny) constraint = 'mortgageGate';
                else if (p.minimumRetirement && p.partTimeEnd > p.duration - p.minimumRetirement) constraint = 'minimumYears';
                else if (p.partTimeNet <= 0) constraint = 'pay';
            } else if (transition && !canStart(p, mode, start, transition.mortgage)) {
                constraint = 'minimumYears';
            }
            const bridge = purchase?.shortfall <= penny ? bridgeBudget(p, plan, purchase) : null;
            const minimumPay = mode === 'partTime' && transition && (!constraint || constraint === 'pay')
                ? minimumPartTimePay(p, plan) : null;
            return {
                p, plan, run, transition, constraint, bridge, minimumPay, success: run.success && constraint === null,
                mortgageOutstanding: run.mortgageOutstanding, failure,
                last, purchase, firstGap: first?.relocation?.shortfall > penny ? null : first?.budgetGap,
                availableAfterPurchase: purchase && purchase.shortfall <= penny ? purchase.available + purchase.net : null,
                annualOverpayment: run.rows.reduce((total, row) => total + (row.annualOverpay ?? 0), 0),
                unfundedAnnualOverpayment: run.rows.reduce((total, row) => total + (row.annualOverpayUnfunded ?? 0), 0)
            };
        }
        const uk = [evaluate(base, 'partTime', ukStart)];
        if (laterUkStart !== ukStart) uk.push(evaluate(base, 'partTime', laterUkStart));
        const moves = includeRelocation ? [lowerPrice, higherPrice].map(replacementHome =>
            evaluate(prepare({ ...inputs, relocate: true, moveAge, replacementHome }), 'full', moveStart)) : [];
        return [...uk, ...moves];
    }

    function minimumPartTimePay(p, plan) {
        // Apply the same pay estimate to each trial. A manual gross keeps
        // the entered gross-to-net cash difference fixed for sensitivity.
        const deductions = p.partTimeGross - p.partTimeNet;
        const funded = net => simulate({
            ...p, partTimeNet: net,
            partTimeGross: p.estimatePartTimeGross || p.partTimeNet <= 0 ? partTimeGrossEstimate(p, net) : net + deductions
        }, plan, { buffered: true }).success;
        if (funded(0)) return 0;
        let low = 0;
        let high = Math.max(1000, Math.ceil(p.partTimeNet));
        while (high < 1e10 && !funded(high)) high *= 2;
        if (high >= 1e10 && !funded(high)) return null;
        while (high - low > 1) {
            const probe = Math.floor((low + high) / 2);
            if (funded(probe)) high = probe;
            else low = probe;
        }
        return high;
    }

    function bridgeBudget(p, plan, purchase) {
        const duration = Math.min(p.access, p.duration);
        if (duration <= plan.start) return null;
        let low = 0;
        // The first month's liquid assets and gross benefits bound any
        // feasible level spending, even with later growth or income.
        let high = Math.floor(Math.max(0, purchase.available + purchase.net)
            + p.statePensionAmount / 12 + penny) + 1;
        while (high - low > 1) {
            const probe = Math.floor((low + high) / 2);
            const funded = simulate({ ...p, duration, abroadRetirement: probe * 12, abroadHealthcare: 0 },
                plan, { buffered: true }).success;
            if (funded) low = probe;
            else high = probe;
        }
        return { monthly: low, endAge: (p.age + duration) / 12 };
    }

    function decisionMonth(p, age, description) {
        const m = months(age) - p.age;
        if (!Number.isFinite(m) || m < 0 || m >= p.duration) {
            throw new Error('Choose a ' + description + ' age between today and the planning horizon.');
        }
        return m;
    }

    function marketPathSampler(p, seed) {
        let state = seed >>> 0;
        const sigma = p.volatility / 100 / Math.sqrt(12);
        function uniform() {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return (state + 0.5) / 4294967296;
        }
        return () => Float64Array.from(p.prices, () => {
            if (!sigma) return p.monthlyGrowth;
            const normal = Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
            return p.monthlyGrowth * Math.exp(sigma * normal - sigma ** 2 / 2);
        });
    }

    function marketPaths(p, count, seed) {
        return Array.from({ length: count }, marketPathSampler(p, seed));
    }

    // Every candidate sees the same calendar-month returns, including paths that previously failed.
    // Search chronologically because a later date can still have a lower success rate.
    function* findSuccessAges(p, target, { count = 500, seed = simulationSeed } = {}) {
        if (!Number.isFinite(target) || target <= 0 || target > 100) throw new RangeError('Use a success target above 0% and up to 100%.');
        const required = Math.ceil(count * target / 100);
        const paths = marketPaths(p, count, seed);
        const workStates = paths.map(() => initial(p));
        const plans = { full: null, coast: null, partTime: null };
        for (let month = 0; month < p.duration; month++) {
            const workingState = workStates.find(Boolean);
            if (!workingState) break;
            const pending = modes.filter(mode => !plans[mode] && month < eligibleUntil(p, mode));
            if (!pending.length) break;
            for (const mode of pending) {
                if (!canStart(p, mode, month, workingState.mortgage)) continue;
                const plan = { mode, start: month };
                let successes = 0;
                let tested = 0;
                for (; tested < count; tested++) {
                    if (workStates[tested] && simulate(p, plan, { start: month, state: workStates[tested],
                        growthAt: t => paths[tested][t] }).success) successes++;
                    if (successes + count - tested - 1 < required) break;
                    if (tested % 16 === 15) yield month;
                }
                if (tested === count && successes >= required) plans[mode] = { ...plan, successes, count };
            }
            yield month;
            // Purchase affordability can vary across paths. Preserve failed
            // paths in the denominator, even after their working projection ends.
            for (let i = 0; i < count; i++) {
                const s = workStates[i];
                if (s && advance(s, p, month, 'Working', paths[i][month], false).shortfall > penny) {
                    workStates[i] = null;
                }
            }
        }
        return plans;
    }

    function stressTest(p, plan, { count = 500, seed = simulationSeed, buffered = false } = {}) {
        let successes = 0;
        const quantiles = Array.from({ length: p.duration + 1 }, () => []);
        const failures = { bridge: 0, later: 0, budget: 0, mortgage: 0 };
        const failureMonths = [];
        const paths = marketPaths(p, count, seed);
        for (let i = 0; i < count; i++) {
            const path = simulate(p, plan, { record: true, buffered, growthAt: month => paths[i][month] });
            if (path.success) successes++;
            else {
                const m = path.failureMonth - 1;
                const phase = phaseAt(plan, p, m);
                const reason = path.relocationShortfall ? 'relocation' : path.mortgageOutstanding ? 'mortgage'
                    : phase === 'Working' || phase === 'Coasting' ? 'budget'
                    : m < p.access ? 'bridge' : 'later';
                failures[reason] = (failures[reason] ?? 0) + 1;
                failureMonths.push(path.failureMonth);
            }
            for (const row of path.rows) {
                if (row.shortfall > penny || (path.mortgageOutstanding && row.month === p.duration)) break;
                quantiles[row.month].push(row.portfolio);
            }
        }
        const ranges = quantiles.map(values => {
            values.sort((a, b) => a - b);
            return { surviving: values.length, low: values[Math.floor((values.length - 1) * 0.10)],
                high: values[Math.floor((values.length - 1) * 0.90)] };
        });
        failureMonths.sort((a, b) => a - b);
        const medianFailureMonth = failureMonths.length
            ? (failureMonths[Math.floor((failureMonths.length - 1) / 2)]
                + failureMonths[Math.floor(failureMonths.length / 2)]) / 2 : null;
        return { successes, count, ranges, failures, medianFailureMonth };
    }

    function* countSuccessSteps(p, plan, { count = 500, seed = simulationSeed, buffered = false } = {}) {
        const sample = marketPathSampler(p, seed);
        let successes = 0;
        for (let i = 0; i < count; i++) {
            const path = sample();
            if (simulate(p, plan, { buffered, growthAt: month => path[month] }).success) successes++;
            if (i % 8 === 7) yield;
        }
        return { successes, count };
    }

    function confirmSuccess(p, plan, { seed = 2246822519, ...options } = {}) {
        const steps = countSuccessSteps(p, plan, { seed, ...options });
        let step;
        do { step = steps.next(); } while (!step.done);
        return step.value;
    }

    return Object.freeze({ defaults, exampleDefaults, restoreSettings, prepare, project, compare, decision,
        partTimeEnabled, simulate, projectionDetails, workingBudget, dependentSettings, settingIsActive,
        stressTest, findSuccessAges, countSuccessSteps, confirmSuccess });
})(typeof module === 'undefined' ? UKTax : require('./uk-tax.js'));

if (typeof module !== 'undefined') module.exports = FireModel;
