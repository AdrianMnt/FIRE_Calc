'use strict';

const FireModel = ((tax) => {
    const penny = 0.005;
    const months = age => Math.round(age * 12);
    const defaults = Object.freeze({
        currentAge: 32, horizonAge: 95, startingIsa: 10000, startingPension: 10000,
        startingCash: 0, homeValue: 0, otherAssets: 0, otherDebt: 0,
        mortgageRemaining: 200000, mortgageBase: 1000, mortgageOverpay: 900,
        mortgageRate: 4.1, mortgageTerm: 0, redirectMortgage: false,
        netIncome: 4000, livingExpenses: 2000, monthlyIsa: 100, workplacePension: 0,
        monthlySipp: 0, sippGrossFactor: 1, grossReturn: 7, fees: 0.25, inflation: 2.5,
        targetIncome: 24000, overFundBuffer: 0, pensionAccessAge: 57,
        statePensionAge: 68, statePensionAmount: 0, region: 'rest',
        lumpSumAllowance: 268275, lumpSumEnabled: false, lumpSumAmount: 0,
        coastAge: 60, useCoastNet: false, coastNet: 0, coastAfterMortgage: false,
        partTimeNet: 0, partTimeGross: 0, partTimeEndAge: 60, partTimeAfterMortgage: false,
        monteCarlo: false, volatility: 15
    });

    function prepare(inputs) {
        const p = { ...defaults, ...inputs };
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
            || p.statePensionAge > 120 || p.mortgageTerm > 102) {
            throw new Error('Use ages from 18 to 120 and a horizon after your current age.');
        }
        if (p.grossReturn < -50 || p.grossReturn > 100 || p.inflation < -20 || p.inflation > 100
            || p.fees > 20 || p.mortgageRate > 100 || p.volatility > 100
            || p.overFundBuffer > 100 || p.sippGrossFactor < 1 || p.sippGrossFactor > 2
            || !['rest', 'scotland'].includes(p.region)) {
            throw new Error('Check the tax region and return, inflation, fee and savings rates.');
        }
        if (p.partTimeNet > p.partTimeGross) {
            throw new Error('Part-time take-home pay cannot exceed taxable gross pay.');
        }
        const age = months(p.currentAge);
        const duration = months(p.horizonAge) - age;
        const realGrowth = (1 + p.grossReturn / 100) * (1 - p.fees / 100) / (1 + p.inflation / 100);
        return {
            ...p, age, duration, realGrowth, monthlyGrowth: realGrowth ** (1 / 12),
            prices: Array.from({ length: duration + 1 }, (_, m) => (1 + p.inflation / 100) ** (m / 12)),
            access: months(p.pensionAccessAge) - age,
            stateStart: months(p.statePensionAge) - age,
            coastEnd: months(p.coastAge) - age,
            partTimeEnd: months(p.partTimeEndAge) - age,
            maturity: months(p.mortgageTerm) || Infinity
        };
    }

    function initial(p) {
        return {
            isa: p.startingIsa, cash: p.startingCash, pension: p.startingPension, drawdown: 0,
            mortgage: p.mortgageRemaining, allowance: p.lumpSumAllowance, lumpTaken: false
        };
    }

    function phaseAt(plan, p, m) {
        if (m < plan.start) return 'Working';
        if (plan.mode === 'coast' && m < p.coastEnd) return 'Coasting';
        if (plan.mode === 'partTime' && m < p.partTimeEnd) return 'Part-time';
        return 'Retired';
    }

    function mortgagePayment(balance, p, m, working) {
        const due = balance * (1 + p.mortgageRate / 1200);
        const scheduled = p.mortgageBase + (working ? p.mortgageOverpay : 0);
        return m + 1 >= p.maturity ? due : Math.min(due, scheduled);
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

    function drawPension(s, p, price, need, otherTaxable) {
        const available = s.drawdown + s.pension;
        if (available === 0) return { net: 0, gross: 0, tax: 0 };
        const free = gross => Math.min(Math.max(0, gross - s.drawdown) / 4, s.allowance / price);
        const due = gross => tax.incrementalMonthlyTax(otherTaxable, gross - free(gross), p.region);
        let high = Math.min(available, need / 0.30);
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

    // Month m starts with snapshot m. Cash flows occur first, then growth produces snapshot m+1.
    function advance(s, p, m, phase, growth, buffered) {
        const price = p.prices[m];
        const working = phase === 'Working';
        const paid = mortgagePayment(s.mortgage, p, m, working);
        s.mortgage = Math.max(0, s.mortgage * (1 + p.mortgageRate / 1200) - paid);
        const mortgageCost = paid / price;
        const flow = { phase, mortgageCost, statePension: 0, tax: 0, drawn: 0, shortfall: 0, surplus: 0 };

        if (working || phase === 'Coasting') {
            const plannedIsa = working ? p.monthlyIsa : 0;
            const sippCost = working ? p.monthlySipp : 0;
            const pay = !working && p.useCoastNet ? p.coastNet : p.netIncome;
            flow.surplus = pay - p.livingExpenses - mortgageCost - plannedIsa - sippCost;
            flow.shortfall = Math.max(0, -flow.surplus);
            if (flow.shortfall <= penny && working) {
                const formerPayment = p.mortgageRemaining > 0 && p.redirectMortgage
                    ? Math.max(0, (p.mortgageBase + p.mortgageOverpay - paid) / price) : 0;
                const redirected = Math.min(Math.max(0, flow.surplus), formerPayment);
                s.isa += plannedIsa + redirected;
                s.pension += p.workplacePension + sippCost * p.sippGrossFactor;
                flow.surplus -= redirected;
            }
        } else {
            const partTime = phase === 'Part-time';
            const taxablePay = partTime ? p.partTimeGross : 0;
            const netPay = partTime ? p.partTimeNet : 0;
            const stateGross = m >= p.stateStart ? p.statePensionAmount / 12 : 0;
            flow.statePension = stateGross;
            flow.tax = tax.incrementalMonthlyTax(taxablePay, stateGross, p.region);
            const spend = p.targetIncome / 12 * (1 + (buffered ? p.overFundBuffer / 100 : 0));
            let need = spend + mortgageCost - netPay - stateGross + flow.tax;
            if (m >= p.access) takeLumpSum(s, p, price);

            if (need < 0) {
                // Keep any excess income as cash available for later spending.
                s.cash -= need;
            } else {
                const fromCash = Math.min(s.cash, need);
                s.cash -= fromCash;
                need -= fromCash;
                const fromIsa = Math.min(s.isa, need);
                s.isa -= fromIsa;
                need -= fromIsa;
                flow.drawn = fromCash + fromIsa;
                if (need > penny && m >= p.access) {
                    const pension = drawPension(s, p, price, need, taxablePay + stateGross);
                    flow.drawn += pension.gross;
                    flow.tax += pension.tax;
                    need -= pension.net;
                }
                flow.shortfall = Math.max(0, need);
            }
        }
        s.isa *= growth;
        s.pension *= growth;
        s.drawdown *= growth;
        s.cash *= price / p.prices[m + 1];
        return flow;
    }

    function snapshot(s, p, m) {
        const pension = s.pension + s.drawdown;
        const mortgage = s.mortgage / p.prices[m];
        const accessible = s.isa + s.cash;
        const portfolio = accessible + pension;
        const netWorth = portfolio + p.homeValue + p.otherAssets - mortgage - p.otherDebt;
        return { month: m, age: (p.age + m) / 12, isa: s.isa, cash: s.cash,
            pension, mortgage, accessible, portfolio, netWorth };
    }

    function simulate(p, plan, { start = 0, state = initial(p), buffered = false,
        record = false, growthAt = () => p.monthlyGrowth } = {}) {
        const s = { ...state };
        const rows = record ? [snapshot(s, p, start)] : [];
        for (let m = start; m < p.duration; m++) {
            const flow = advance(s, p, m, phaseAt(plan, p, m), growthAt(m), buffered);
            if (record) rows.push({ ...snapshot(s, p, m + 1), ...flow });
            if (flow.shortfall > penny) return { rows, success: false, failureMonth: m + 1 };
        }
        const success = s.mortgage / p.prices[p.duration] <= penny;
        return { rows, success, failureMonth: success ? null : p.duration, mortgageOutstanding: !success };
    }

    const modes = ['full', 'coast', 'partTime'];

    function eligibleUntil(p, mode) {
        if (mode === 'coast') return p.coastEnd < p.duration ? p.coastEnd : 0;
        if (mode === 'partTime') return p.partTimeNet > 0 ? Math.min(p.duration, p.partTimeEnd) : 0;
        return p.duration;
    }

    function canStart(p, mode, month, mortgage) {
        const mortgageRequired = mode === 'coast' ? p.coastAfterMortgage
            : mode === 'partTime' && p.partTimeAfterMortgage;
        return month < eligibleUntil(p, mode) && (!mortgageRequired || mortgage / p.prices[month] <= penny);
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

    function milestones(rows) {
        const validRows = rows.filter(row => !(row.shortfall > penny));
        return ['accessible', 'pension', 'netWorth'].flatMap(metric => milestoneTargets.map(target => {
            const first = validRows.find(row => row[metric] >= target);
            return { metric, target, month: first?.month ?? null };
        }));
    }

    function project(inputs, mode = 'full') {
        const p = prepare(inputs);
        const plans = findPlans(p);
        const selected = plans[mode] ?? null;
        const baseline = simulate(p, selected ?? { mode: 'full', start: Infinity }, { record: true });
        const work = advance(initial(p), p, 0, 'Working', p.monthlyGrowth, false);
        return { p, plans, selected, baseline, work, milestones: milestones(baseline.rows) };
    }

    function marketPaths(p, count, seed) {
        let state = seed >>> 0;
        const sigma = p.volatility / 100 / Math.sqrt(12);
        function uniform() {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return (state + 0.5) / 4294967296;
        }
        return Array.from({ length: count }, () => Float64Array.from(p.prices, () => {
            if (!sigma) return p.monthlyGrowth;
            const normal = Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
            return p.monthlyGrowth * Math.exp(sigma * normal - sigma ** 2 / 2);
        }));
    }

    // Every candidate sees the same calendar-month returns, including paths that previously failed.
    // Search chronologically because a later date can still have a lower success rate.
    function* findSuccessAges(p, target, { count = 500, seed = 123456789 } = {}) {
        if (!Number.isFinite(target) || target <= 0 || target > 100) throw new RangeError('Use a success target above 0% and up to 100%.');
        const required = Math.ceil(count * target / 100);
        const paths = marketPaths(p, count, seed);
        const workStates = paths.map(() => initial(p));
        const plans = { full: null, coast: null, partTime: null };
        for (let month = 0; month < p.duration; month++) {
            const pending = modes.filter(mode => !plans[mode] && month < eligibleUntil(p, mode));
            if (!pending.length) break;
            for (const mode of pending) {
                if (!canStart(p, mode, month, workStates[0].mortgage)) continue;
                const plan = { mode, start: month };
                let successes = 0;
                let tested = 0;
                for (; tested < count; tested++) {
                    if (simulate(p, plan, { start: month, state: workStates[tested],
                        growthAt: t => paths[tested][t] }).success) successes++;
                    if (successes + count - tested - 1 < required) break;
                    if (tested % 16 === 15) yield month;
                }
                if (tested === count && successes >= required) plans[mode] = { ...plan, successes, count };
            }
            yield month;
            // The working budget and mortgage do not depend on market returns.
            if (advance(workStates[0], p, month, 'Working', paths[0][month], false).shortfall > penny) break;
            for (let i = 1; i < count; i++) advance(workStates[i], p, month, 'Working', paths[i][month], false);
        }
        return plans;
    }

    function stressTest(p, plan, { count = 500, seed = 123456789 } = {}) {
        let successes = 0;
        const quantiles = Array.from({ length: p.duration + 1 }, () => []);
        const paths = marketPaths(p, count, seed);
        for (let i = 0; i < count; i++) {
            const path = simulate(p, plan, { record: true, growthAt: month => paths[i][month] });
            if (path.success) successes++;
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
        return { successes, count, ranges };
    }

    return Object.freeze({ defaults, prepare, project, simulate, stressTest, findSuccessAges });
})(typeof module === 'undefined' ? UKTax : require('./uk-tax.js'));

if (typeof module !== 'undefined') module.exports = FireModel;
