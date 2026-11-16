'use strict';

const FireModel = ((tax) => {
    const penny = 0.005;
    const months = age => Math.round(age * 12);
    const defaults = Object.freeze({
        currentAge: 35, horizonAge: 95, startingIsa: 40000, startingPension: 60000,
        startingCash: 10000, startingLisa: 0, cashInterest: 0, homeValue: 250000, otherAssets: 0, otherDebt: 0,
        mortgageRemaining: 150000, mortgageBase: 800, mortgageOverpay: 200,
        mortgageRate: 4, mortgageTerm: 25, redirectMortgage: false,
        netIncome: 3500, livingExpenses: 1700, monthlyCash: 0, monthlyIsa: 500, workplacePension: 600,
        monthlySipp: 0, sippGrossFactor: 1, grossReturn: 7, fees: 0.25, inflation: 2.5,
        targetIncome: 26400, minimumRetiredYears: 0, overFundBuffer: 0, pensionAccessAge: 57,
        statePensionAge: 68, statePensionAmount: 0, region: 'rest',
        lumpSumAllowance: 268275, lumpSumEnabled: false, lumpSumAmount: 0,
        coastAge: 60, useCoastNet: false, coastNet: 0, coastAfterMortgage: false,
        partTimeNet: 1800, partTimeGross: 2100, partTimeEndAge: 60, partTimeAfterMortgage: false,
        monteCarlo: false, volatility: 15,
        splitHouseholdTax: false, pensionTaxExtra: 0,
        relocate: false, moveAge: 38, replacementHome: 90000, saleCosts: 4000,
        purchaseCosts: 3000, movingCosts: 5000, abroadLiving: 1250, abroadRetirement: 15000,
        abroadHealthcare: 150, abroadNetIncome: 2000, abroadCoastNet: 1500, abroadPartTimeNet: 1000,
        abroadInvest: 300, abroadPension: 0, abroadPensionTax: 20, abroadStateTax: 20,
        customMilestones: ''
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
            || p.statePensionAge > 120 || p.mortgageTerm > 102 || p.minimumRetiredYears > 102) {
            throw new Error('Use ages from 18 to 120 and a horizon after your current age.');
        }
        if (p.grossReturn < -50 || p.grossReturn > 100 || p.inflation < -20 || p.inflation > 100
            || p.fees > 20 || p.cashInterest > 100 || p.mortgageRate > 100 || p.volatility > 100
            || p.overFundBuffer > 100 || p.sippGrossFactor < 1 || p.sippGrossFactor > 2
            || !['rest', 'scotland'].includes(p.region)) {
            throw new Error('Check the tax region and return, inflation, fee and savings rates.');
        }
        if (p.abroadPensionTax > 100 || p.abroadStateTax > 100 || p.pensionTaxExtra > 20) {
            throw new Error('Use effective tax rates up to 100% abroad and a UK pension tax uplift up to 20 points.');
        }
        const targets = parseMilestones(p.customMilestones);
        if (p.partTimeNet > p.partTimeGross) {
            throw new Error('Part-time take-home pay cannot exceed taxable gross pay.');
        }
        const age = months(p.currentAge);
        const duration = months(p.horizonAge) - age;
        const move = p.relocate ? months(p.moveAge) - age : Infinity;
        if (move < 0 || (p.relocate && move >= duration)) {
            throw new Error('Choose a relocation age from your current age to before the planning horizon.');
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
        const equity = s.home - s.mortgage / price;
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

    // Month m starts with snapshot m. Cash flows occur first, then growth produces snapshot m+1.
    function advance(s, p, m, phase, growth, buffered) {
        const price = p.prices[m];
        const working = phase === 'Working';
        const abroad = m >= p.move;
        const flow = { phase, abroad, mortgageCost: 0, statePension: 0, tax: 0, drawn: 0,
            shortfall: 0, surplus: 0, isaAdded: 0 };
        if (m === p.move) {
            flow.relocation = relocateHome(s, p, price, m >= p.lisaAccess);
            if (flow.relocation.shortfall > penny) {
                flow.shortfall = flow.relocation.shortfall;
                return flow;
            }
        }
        const paid = mortgagePayment(s.mortgage, p, m, working);
        s.mortgage = Math.max(0, s.mortgage * (1 + p.mortgageRate / 1200) - paid);
        const mortgageCost = paid / price;
        flow.mortgageCost = mortgageCost;

        if (working || phase === 'Coasting') {
            const plannedInvestment = working ? (abroad ? p.abroadInvest : p.monthlyIsa) : 0;
            const savingCash = working && !abroad ? p.monthlyCash : 0;
            const sippCost = working && !abroad ? p.monthlySipp : 0;
            const pay = abroad ? (working ? p.abroadNetIncome : p.abroadCoastNet)
                : (!working && p.useCoastNet ? p.coastNet : p.netIncome);
            const living = abroad ? p.abroadLiving + p.abroadHealthcare : p.livingExpenses;
            flow.surplus = pay - living - mortgageCost - plannedInvestment - savingCash - sippCost;
            flow.shortfall = Math.max(0, -flow.surplus);
            if (flow.shortfall <= penny && working) {
                const formerPayment = !abroad && p.mortgageRemaining > 0 && p.redirectMortgage
                    ? Math.max(0, (p.mortgageBase + p.mortgageOverpay - paid) / price) : 0;
                const redirected = Math.min(Math.max(0, flow.surplus), formerPayment);
                if (abroad) s.taxable += plannedInvestment;
                else {
                    flow.isaAdded = plannedInvestment + redirected;
                    s.isa += flow.isaAdded;
                    s.cash += savingCash;
                }
                s.pension += abroad ? p.abroadPension : p.workplacePension + sippCost * p.sippGrossFactor;
                flow.surplus -= redirected;
            }
        } else {
            const partTime = phase === 'Part-time';
            const taxablePay = partTime ? p.partTimeGross : 0;
            const netPay = partTime ? (abroad ? p.abroadPartTimeNet : p.partTimeNet) : 0;
            const stateGross = m >= p.stateStart ? p.statePensionAmount / 12 : 0;
            flow.statePension = stateGross;
            flow.tax = abroad ? stateGross * p.abroadStateTax / 100 : ukIncomeTax(p, taxablePay, stateGross);
            const budget = abroad ? p.abroadRetirement / 12 + p.abroadHealthcare : p.targetIncome / 12;
            const spend = budget * (1 + (buffered ? p.overFundBuffer / 100 : 0));
            let need = spend + mortgageCost - netPay - stateGross + flow.tax;
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
        return { p, plans, selected, baseline, work, milestones: milestones(baseline.rows, p.targets),
            maxIsaDeposits: maxAnnualIsaDeposits(baseline.rows) };
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
            if (p.mortgageRemaining > 0 && p.mortgageOverpay > 0) {
                results.push(evaluate('No mortgage overpayment', { ...p, mortgageOverpay: 0 }));
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

    function stressTest(p, plan, { count = 500, seed = 123456789 } = {}) {
        let successes = 0;
        const quantiles = Array.from({ length: p.duration + 1 }, () => []);
        const failures = { bridge: 0, later: 0, budget: 0, mortgage: 0 };
        const failureMonths = [];
        const paths = marketPaths(p, count, seed);
        for (let i = 0; i < count; i++) {
            const path = simulate(p, plan, { record: true, growthAt: month => paths[i][month] });
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

    function confirmSuccess(p, plan, { count = 500, seed = 2246822519 } = {}) {
        const paths = marketPaths(p, count, seed);
        let successes = 0;
        for (const path of paths) {
            if (simulate(p, plan, { growthAt: month => path[month] }).success) successes++;
        }
        return { successes, count };
    }

    return Object.freeze({ defaults, prepare, project, compare, partTimeEnabled, simulate, stressTest, findSuccessAges, confirmSuccess });
})(typeof module === 'undefined' ? UKTax : require('./uk-tax.js'));

if (typeof module !== 'undefined') module.exports = FireModel;
