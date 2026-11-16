'use strict';

const { defaults, project, compare, partTimeEnabled, simulate, stressTest, findSuccessAges, confirmSuccess } = FireModel;
const get = id => document.getElementById(id);
const storageKey = 'pro-fire-simulator-state-v2';
const pounds = new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0
});
const gbp = value => pounds.format(value);
const age = value => {
    const total = Math.round(value * 12);
    return total % 12 ? `${Math.floor(total / 12)}y ${total % 12}m` : String(total / 12);
};

const groups = [
    ['Profile and balances', [
        ['currentAge', 'Current age'], ['horizonAge', 'Plan through age'],
        ['startingIsa', 'Accessible ISA and investments (£)'], ['startingLisa', 'Lifetime ISA balance (£)', 'Available at age 60.'],  ['startingCash', 'Cash savings (£)'],
        ['cashInterest', 'Annual cash interest after tax (%)', 'Fixed nominal rate. Use 0 for cash with no interest.'],
        ['startingPension', 'Defined-contribution pension balance (£)'],
        ['homeValue', 'Home value (£)'], ['otherAssets', 'Other assets (£)'],
        ['otherDebt', 'Other debt (£)', 'Exclude the mortgage. Include debt payments in spending.']
    ]],
    ['Home and mortgage', [
        ['mortgageRemaining', 'Mortgage balance (£)'],
        ['mortgageBase', 'Regular monthly payment (£)', 'Fixed nominal payment including interest.'],
        ['mortgageOverpay', 'Monthly overpayment while working (£)'],
        ['mortgageRate', 'Mortgage rate (%)', 'Nominal annual rate divided by 12.'],
        ['mortgageTerm', 'Years to mortgage maturity', '0 uses payments until payoff. A term pays any remainder at maturity.'],
        ['redirectMortgage', 'Invest freed mortgage payments while working']
    ]],
    ['Working budget', [
        ['netIncome', 'Monthly take-home income (£)', 'After payroll pension contributions. Include any net pension receipts already in the budget.'],
        ['livingExpenses', 'Monthly spending excluding mortgage (£)'],
        ['monthlyCash', 'Monthly cash saving (£)', 'Use for cash you plan to set aside, including for a move.'],
        ['monthlyIsa', 'Monthly ISA contribution (£)'],
        ['workplacePension', 'Monthly gross workplace pension contribution (£)', 'Include employee and employer contributions already accounted for in payroll.'],
        ['monthlySipp', 'Monthly SIPP cost from take-home pay (£)'],
        ['sippGrossFactor', 'SIPP gross-up multiplier', 'Use 1.25 for standard relief at source, or 1 when no relief is added.']
    ]],
    ['Retirement and pensions', [
        ['targetIncome', 'Annual retirement spending excluding mortgage (£)'],
        ['minimumRetiredYears', 'Minimum years of full retirement', '0 uses the planning horizon alone. Enter 20, for example, to require 20 years with no work income before the horizon.'],
        ['overFundBuffer', 'Extra spending for eligibility test (%)'],
        ['pensionAccessAge', 'Private pension access age', 'Check your scheme rules.'],
        ['statePensionAge', 'State Pension start age'],
        ['statePensionAmount', 'Annual gross State Pension (£)', 'Enter the annual amount. Multiply a weekly forecast by 52 or a monthly amount by 12. 0 assumes no income.'],
        ['region', 'Income Tax region'],
        ['splitHouseholdTax', 'Estimate UK tax for two people with equal taxable income', 'Combined pay, State Pension and pension withdrawals are split equally. Enter the combined remaining lump sum allowance.'],
        ['pensionTaxExtra', 'Extra UK private pension tax (percentage points)', 'Optional sensitivity applied to taxable private pension.'],
        ['lumpSumAllowance', 'Remaining tax-free lump sum allowance (£)'],
        ['lumpSumEnabled', 'Move a one-off tax-free lump sum into cash'],
        ['lumpSumAmount', 'Requested lump sum (£)', 'Taken at pension access during part-time work or retirement, subject to the remaining allowance.']
    ]],
    ['Coast and Barista FIRE', [
        ['coastAge', 'Coast FIRE retirement age', 'Keep working until this age. Income must cover working costs and regular mortgage payments. Contributions and overpayments stop when coasting begins.'],
        ['coastAfterMortgage', 'Start Coast FIRE only after the mortgage is paid off'],
        ['useCoastNet', 'Use a different take-home pay during Coast FIRE'],
        ['coastNet', 'Coast monthly take-home pay (£)', 'Used only when the option above is checked.'],
        ['partTimeNet', 'Part-time monthly take-home pay (£)', 'Enter pay after Income Tax, National Insurance and payroll deductions. 0 disables part-time FIRE.'],
        ['partTimeGross', 'Part-time monthly taxable pay (£)', 'Enter before Income Tax and after any salary sacrifice.'],
        ['partTimeEndAge', 'Age part-time work ends'],
        ['partTimeAfterMortgage', 'Start Barista FIRE only after the mortgage is paid off']
    ]],
    ['Romania relocation', [
        ['relocate', 'Model sale of the UK home and a cash purchase in Romania'],
        ['moveAge', 'Age at relocation'],
        ['replacementHome', 'Romanian home price (£ equivalent)', 'Try £75,000 and £100,000 to compare purchase prices.'],
        ['saleCosts', 'UK sale and mortgage exit costs (£)', 'Include agent, legal and early repayment charges.'],
        ['purchaseCosts', 'Romanian purchase costs (£ equivalent)'],
        ['movingCosts', 'Moving, FX and setup costs (£ equivalent)'],
        ['abroadLiving', 'Monthly work and Coast spending in Romania (£ equivalent)'],
        ['abroadRetirement', 'Annual Barista and retirement spending in Romania (£ equivalent)'],
        ['abroadHealthcare', 'Additional monthly healthcare in Romania (£ equivalent)', 'Added in every phase. Include healthcare here or in base spending.'],
        ['abroadNetIncome', 'Full-time monthly take-home in Romania (£ equivalent)'],
        ['abroadCoastNet', 'Coast monthly take-home in Romania (£ equivalent)'],
        ['abroadPartTimeNet', 'Part-time monthly take-home in Romania (£ equivalent)'],
        ['abroadInvest', 'Monthly accessible investment while working in Romania (£ equivalent)', 'Deposited outside the UK ISA. Use returns net of investment taxes.'],
        ['abroadPension', 'Monthly gross pension contribution while working in Romania (£ equivalent)', 'Uses the shared pension pot. Take-home pay should already reflect employee contributions.'],
        ['abroadPensionTax', 'Effective tax on gross private pension in Romania (%)', 'Editable assumption for all private withdrawals after the move.'],
        ['abroadStateTax', 'Effective tax on gross State Pension in Romania (%)', 'Editable planning assumption.']
    ]],
    ['Milestone targets', [
        ['customMilestones', 'Milestone amounts (£)', 'Enter up to 12 amounts separated by commas, such as 25000, 100000, 300000. Leave blank for defaults.']
    ]],
    ['Returns and stress test', [
        ['grossReturn', 'Annual nominal return before fees (%)'],
        ['fees', 'Annual investment fees (%)'], ['inflation', 'Annual inflation (%)'],
        ['monteCarlo', 'Run 500 market-return simulations'],
        ['volatility', 'Annual return volatility (%)']
    ]]
];

function element(tag, value) {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    return node;
}

function savedInputs() {
    try {
        return JSON.parse(localStorage.getItem(storageKey)
            || localStorage.getItem('pro-fire-simulator-state-v1')) || {};
    } catch {
        return {};
    }
}

const saved = savedInputs();
const fields = new Map();
for (const [title, specs] of groups) {
    const section = element('details');
    section.open = title === groups[0][0];
    section.append(element('summary', title));
    for (const [key, name, help] of specs) {
        const label = element('label');
        let input;
        const value = saved[key] ?? defaults[key];
        if (key === 'region') {
            input = element('select');
            for (const [value, text] of [['rest', 'England, Wales or Northern Ireland'], ['scotland', 'Scotland']]) {
                const option = element('option', text);
                option.value = value;
                input.append(option);
            }
            input.value = value;
            label.append(document.createTextNode(name), input);
        } else {
            input = element('input');
            if (typeof defaults[key] === 'boolean') {
                input.type = 'checkbox';
                input.checked = value === true;
                label.append(input, document.createTextNode(name));
            } else {
                input.type = typeof defaults[key] === 'number' ? 'number' : 'text';
                if (input.type === 'number') {
                    input.step = 'any';
                    input.required = true;
                }
                input.value = value;
                label.append(document.createTextNode(name), input);
            }
        }
        input.id = key;
        if (help) {
            const note = element('small', help);
            note.id = `${key}-help`;
            input.setAttribute('aria-describedby', note.id);
            label.append(note);
        }
        section.append(label);
        fields.set(key, input);
    }
    get('inputs').append(section);
}

const mode = get('mode');
const riskEnabled = get('risk-enabled');
const riskTarget = get('risk-target');
riskEnabled.checked = saved.riskEnabled === true;
riskTarget.value = saved.riskTarget ?? 90;
if (['full', 'coast', 'partTime'].includes(saved.mode)) mode.value = saved.mode;
const scenarioNames = { full: 'Full FIRE', coast: 'Coast FIRE', partTime: 'Barista FIRE' };
const balanceSeries = [
    ['accessible', 'Accessible assets', '--isa'], ['pension', 'Pension', '--pension'],
    ['mortgage', 'Mortgage', '--mortgage'], ['netWorth', 'Net worth', '--worth']
];
const chart = new ProjectionChart({
    canvas: get('chart'), tooltip: get('chart-tooltip'), reading: get('chart-reading'),
    legend: get('legend'), controls: get('chart-options'), series: balanceSeries, age, gbp
});

function renderTimeline(result) {
    const { rows } = result.baseline;
    const payoff = rows.find(row => row.mortgage <= 0.005 && !(row.shortfall > 0.005));
    const tableRows = [];
    let totals = [0, 0, 0, 0];
    for (const row of rows) {
        const [drawn, state, tax, shortfall] = totals;
        totals = [drawn + (row.drawn ?? 0), state + (row.statePension ?? 0),
            tax + (row.tax ?? 0), shortfall + (row.shortfall ?? 0)];
        const next = rows[row.month + 1];
        if (row.month % 12 !== 0 && row.month !== result.selected?.start
            && row.month !== payoff?.month && !row.relocation && row.phase === next?.phase) continue;
        const tr = element('tr');
        const heading = element('th', age(row.age));
        heading.scope = 'row';
        tr.append(heading, element('td', next?.phase ?? row.phase ?? 'Working'));
        const balances = row.shortfall > 0.005
            ? Array(8).fill(null) : [row.cash, row.isa, row.taxable, row.lisa, row.pension, row.mortgage, row.equity, row.netWorth];
        for (const value of [...balances, ...totals]) {
            tr.append(element('td', value === null ? 'Outside plan' : gbp(value)));
        }
        tableRows.push(tr);
        totals = [0, 0, 0, 0];
    }
    get('timeline').replaceChildren(...tableRows);
}

function renderMilestones(result) {
    const names = { accessible: 'Accessible assets', pension: 'Pension', netWorth: 'Net worth' };
    get('milestones').replaceChildren(...Object.entries(names).map(([key, label]) => {
        const section = element('section');
        const list = element('ul');
        const items = result.milestones.filter(item => item.metric === key);
        const current = result.baseline.rows[0][key];
        const next = items.find(item => item.target > current);
        section.className = 'milestone-group';
        section.dataset.metric = key;
        section.append(element('h3', label), element('strong', gbp(current)));
        if (next) {
            const percent = Math.max(0, current / next.target * 100);
            const progress = element('progress');
            progress.max = next.target;
            progress.value = Math.max(0, current);
            progress.setAttribute('aria-label', label + ' progress towards ' + gbp(next.target));
            section.append(progress, element('p', gbp(next.target - current)
                + ' to ' + gbp(next.target) + ' (' + Math.floor(percent) + '% funded today)'));
        } else {
            section.append(element('p', 'All listed targets reached today.'));
        }
        for (const milestone of items) {
            const row = element('li');
            const status = milestone.month === 0 ? 'Reached' : milestone.month === null
                ? '—' : `Age ${age((result.p.age + milestone.month) / 12)}`;
            const badge = element('span', status);
            if (milestone.month === 0) badge.className = 'achieved';
            if (milestone.month === null) badge.setAttribute('aria-label', 'Outside projection');
            row.append(element('span', gbp(milestone.target)));
            if (milestone.month > 0) {
                const jump = element('button', status);
                jump.type = 'button';
                jump.className = 'milestone-jump';
                jump.setAttribute('aria-label', label + ' reaches ' + gbp(milestone.target)
                    + ' at ' + status.toLowerCase() + '. Show on chart.');
                jump.addEventListener('click', () => chart.showMonth(milestone.month));
                row.append(jump);
            } else row.append(badge);
            list.append(row);
        }
        section.append(list);
        return section;
    }));
}

let openExplanation = null;

function explainScenario(key, result, inputs) {
    const { p, plans } = result;
    const plan = plans[key];
    const mortgageRequired = key === 'coast' ? p.coastAfterMortgage : key === 'partTime' && p.partTimeAfterMortgage;
    if (!plan) {
        const fullRetirementStart = key === 'coast' ? p.coastEnd : key === 'partTime' ? p.partTimeEnd : 0;
        if (p.minimumRetirement && p.duration - Math.max(0, fullRetirementStart) < p.minimumRetirement) {
            return ['The minimum full-retirement period does not fit before the planning horizon at these ages.'];
        }
        if (key === 'partTime' && !partTimeEnabled(p)) return ['Enter your monthly part-time take-home and taxable pay to test a reduced-hours plan.'];
        const coastPay = p.useCoastNet ? p.coastNet : p.netIncome;
        if (key === 'coast' && !p.relocate && coastPay < p.livingExpenses) return [
            `Coast take-home pay of ${gbp(coastPay)} falls short of ${gbp(p.livingExpenses)} in monthly working expenses before any mortgage payment. Coasting requires pay to cover those bills so the investments can stay untouched.`
        ];
        return [mortgageRequired
            ? 'No mortgage-free start met the cash-flow test before this scenario’s end age. The model keeps the full-time budget and any mortgage overpayments until payoff.'
            : 'No start met the cash-flow test with these inputs. Check the working budget, retirement spending, when each income source starts and your planning horizon.'];
    }

    const rows = key === result.selected?.mode && plan.start === result.selected.start
        ? result.baseline.rows : simulate(p, plan, { record: true }).rows;
    const opening = rows[plan.start];
    const first = rows[plan.start + 1];
    const pensionAge = Math.max(opening.age, p.pensionAccessAge);
    const details = [
        `At age ${age(opening.age)}, you have ${gbp(opening.accessible)} in accessible assets and ${gbp(opening.pension)} in your private pension. The eligibility test uses the local retirement budget, any mortgage payments and your spending buffer through age ${age(p.horizonAge)}.`
    ];
    if (key === 'coast') {
        const retirement = rows[p.coastEnd];
        const pay = first.abroad ? p.abroadCoastNet : p.useCoastNet ? p.coastNet : p.netIncome;
        const costs = first.abroad ? p.abroadLiving + p.abroadHealthcare : p.livingExpenses;
        details.push(`You keep working until age ${age(p.coastAge)}. In the first Coast month, ${gbp(pay)} take-home covers ${gbp(costs)} in living costs and ${gbp(first.mortgageCost)} on the mortgage. ISA and pension contributions and mortgage overpayments stop. The model leaves any spare pay out of the portfolio.`);
        details.push(`By age ${age(p.coastAge)}, the model projects ${gbp(retirement.accessible)} in accessible assets and ${gbp(retirement.pension)} in your private pension, using a steady ${((p.realGrowth - 1) * 100).toFixed(2)}% real annual return after fees.`);
    } else if (key === 'partTime') {
        const end = rows[p.partTimeEnd];
        details.push(`You switch to ${gbp(first.abroad ? p.abroadPartTimeNet : p.partTimeNet)} monthly take-home pay at the start and work until age ${age(p.partTimeEndAge)}. Your first month draws ${gbp(first.drawn)} from the portfolio before any tax on private pension withdrawals. Full-time contributions and mortgage overpayments stop at the switch.`);
        if (end) details.push(`When the part-time pay ends, the baseline projects ${gbp(end.accessible)} in cash and ISA and ${gbp(end.pension)} in your pension. The portfolio and any pension income cover the bills from then on.`);
    } else {
        details.push(`Work income and new contributions stop immediately at this age. The first retired month uses ${gbp(first.drawn)} in gross portfolio withdrawals. Private pension is available at age ${age(pensionAge)}. The Lifetime ISA can fund spending from age 60.`);
    }
    if (mortgageRequired) details.push('You chose to wait until the mortgage is fully paid. Until the switch, the model keeps your full-time contributions and mortgage overpayments.');
    if (key === 'partTime' && plans.full && plans.full.start <= plan.start) {
        details.push('Full FIRE is already feasible under the baseline by this age. Part-time work would be optional under these assumptions.');
    }
    if (inputs.grossReturn >= -48) {
        const slower = project({ ...inputs, grossReturn: inputs.grossReturn - 2 }).plans[key];
        details.push(`At a nominal return of ${inputs.grossReturn - 2}% instead of ${inputs.grossReturn}%, the earliest eligible start is ${slower ? 'age ' + age((p.age + slower.start) / 12) : 'outside the plan'}. The headline age uses steady returns. Select this scenario in the Projection to see how its date holds up under variable returns.`);
    }
    return details;
}

function renderSummary(cards, result, inputs, mortgageFree) {
    const { p, baseline, work } = result;
    const opening = baseline.rows[0];
    const show = key => {
        openExplanation = key;
        const panel = get('explanation');
        panel.hidden = key === null;
        for (const button of get('summary').querySelectorAll('button')) {
            button.setAttribute('aria-expanded', String(button.dataset.key === key));
        }
        if (!key) return;
        const [, label, value] = cards.find(card => card[0] === key);
        const other = {
            worth: `${gbp(opening.portfolio)} in investments and cash plus ${gbp(opening.equity)} home equity and ${gbp(p.otherAssets)} other assets, less ${gbp(p.otherDebt)} other debt.`,
            equity: `${gbp(p.homeValue)} home value less ${gbp(opening.mortgage)} mortgage. A sale releases equity after debt and sale costs.`,
            portfolio: `${gbp(opening.liquid)} cash and accessible investments plus ${gbp(opening.lisa)} Lifetime ISA and ${gbp(opening.pension)} private pensions.`,
            accessible: 'Cash and unrestricted investments can fund spending at any age. The Lifetime ISA joins them at age 60. Private pensions are tracked separately.',
            work: work.abroad ? 'The first month uses Romanian take-home pay and spending. See the comparison for purchase funding.' : `${gbp(p.netIncome)} take-home, less ${gbp(p.livingExpenses)} living costs, ${gbp(work.mortgageCost)} mortgage payments, ${gbp(p.monthlyIsa)} ISA savings ${gbp(p.monthlyCash)} cash savings and ${gbp(p.monthlySipp)} personal SIPP costs. The figure is after any automatic mortgage-payment redirection. Workplace pension contributions are already accounted for in payroll.`,
            mortgage: mortgageFree
                ? `${scenarioNames[mode.value]} clears the mortgage ${mortgageFree.month === 0 ? 'today' : 'at age ' + age(mortgageFree.age)}. The mortgage chart shows this payoff month. The model stops overpayments when you leave full-time work. A specified maturity collects any remaining balance in its final month.`
                : 'The selected projection ends before the mortgage is cleared. Check the budget, payments and term.',
            returns: `The model compounds a ${p.grossReturn}% nominal return, applies ${p.fees}% fees and divides by a ${p.inflation}% inflation factor. Cash earns the entered ${p.cashInterest}% nominal rate after tax. The baseline holds the investment return steady each year.`
        };
        get('explanation-title').textContent = label + ' · ' + value;
        const details = key in result.plans ? explainScenario(key, result, inputs) : [other[key]];
        get('explanation-body').replaceChildren(...details.map(text => element('p', text)));
    };

    get('summary').replaceChildren(...cards.map(([key, label, value]) => {
        const card = element('div');
        card.dataset.kind = key;
        const dd = element('dd');
        const button = element('button', value);
        button.type = 'button';
        button.dataset.key = key;
        button.setAttribute('aria-label', label + ' ' + value + '. How it is calculated');
        button.setAttribute('aria-controls', 'explanation');
        button.addEventListener('click', () => show(openExplanation === key ? null : key));
        button.append(element('small', 'How it’s calculated'));
        dd.append(button);
        card.append(element('dt', label), dd);
        return card;
    }));
    show(openExplanation);
}

let currentRiskSearch;
let previousRisk;
let latestInputs;
let latestPrepared;
let targetPreview;

function riskKey(inputs) {
    const { monteCarlo, ...assumptions } = inputs;
    return JSON.stringify([assumptions, riskTarget.valueAsNumber]);
}

function addRiskCardAction(card, plan, key, confirm, target) {
    const checked = 100 * confirm.successes / confirm.count;
    card.append(
        element('small', (100 * plan.successes / plan.count).toFixed(1) + '% on search paths'),
        element('small', checked.toFixed(1) + '% on a fresh set of ' + confirm.count + ' paths')
    );
    const button = element('button', 'View projection');
    button.type = 'button';
    button.className = 'target-link';
    button.setAttribute('aria-label', 'View ' + scenarioNames[plan.mode] + ' projection at the target age');
    button.addEventListener('click', () => {
        targetPreview = { key, plan, target };
        mode.value = plan.mode;
        update();
        chart.setView('stress');
        get('show-baseline').focus();
        get('projection-basis').scrollIntoView({ block: 'nearest' });
    });
    card.append(button);
}

function updateRisk(p, inputs) {
    const settings = get('risk-settings');
    settings.hidden = !riskEnabled.checked;
    const status = get('risk-status');
    const output = get('risk-results');

    if (!riskEnabled.checked || !riskTarget.validity.valid || !p) {
        currentRiskSearch = null;
        output.replaceChildren();
        status.textContent = riskEnabled.checked && p ? 'Enter a target from 0.1% to 100%.' : '';
        return;
    }
    const target = riskTarget.valueAsNumber;
    const key = riskKey(inputs);
    if (currentRiskSearch?.key === key) return;
    function show(plans, checks) {
        output.replaceChildren(...Object.entries(plans).map(([name, plan]) => {
            const card = element('div');
            card.dataset.kind = name;
            const value = plan ? 'Age ' + age((p.age + plan.start) / 12)
                : name === 'partTime' && p.partTimeNet <= 0 ? 'Off' : 'No qualifying age';
            const details = element('dd', value);
            card.append(element('dt', scenarioNames[name]), details);
            if (plan) addRiskCardAction(details, plan, key, checks[name], target);
            return card;
        }));
        status.textContent = '';
    }
    if (previousRisk?.key === key) {
        currentRiskSearch = null;
        show(previousRisk.plans, previousRisk.checks);
        return;
    }
    output.replaceChildren();
    status.textContent = 'Checking start dates…';
    const search = { key, steps: findSuccessAges(p, target) };
    currentRiskSearch = search;
    function runSlice() {
        if (currentRiskSearch !== search) return;
        try {
            const deadline = performance.now() + 20;
            let step;
            do {
                step = search.steps.next();
                if (step.done) {
                    currentRiskSearch = null;
                    const plans = step.value;
                    const checks = Object.fromEntries(Object.entries(plans)
                        .filter(([, plan]) => plan)
                        .map(([name, plan]) => [name, confirmSuccess(p, plan)]));
                    previousRisk = { key, plans, checks };
                    show(plans, checks);
                    return;
                }
            } while (performance.now() < deadline);
            const decade = Math.floor(step.value / 120);
            if (decade !== search.decade) {
                search.decade = decade;
                status.textContent = 'Checking starts around age ' + age((p.age + step.value) / 12) + '…';
            }
            setTimeout(runSlice, 0);
        } catch (error) {
            currentRiskSearch = null;
            status.textContent = 'The search stopped before it finished.';
            console.error('Success-target search failed', error);
        }
    }
    setTimeout(runSlice, 0);
}

function saveInputs(inputs) {
    try {
        localStorage.setItem(storageKey, JSON.stringify({ ...inputs, mode: mode.value,
            riskEnabled: riskEnabled.checked, riskTarget: riskTarget.validity.valid ? riskTarget.valueAsNumber : 90 }));
    } catch {
        // The calculator can still run when storage is unavailable.
    }
}

function renderPlanEvents(result, mortgageFree) {
    const { p, selected, baseline } = result;
    const last = baseline.rows.filter(row => !(row.shortfall > 0.005)).at(-1).month;
    const events = [];
    if (selected) {
        events.push([selected.start, scenarioNames[selected.mode] + ' starts', 'start']);
        const retired = baseline.rows.find(row => row.phase === 'Retired');
        if (retired && retired.month - 1 !== selected.start) {
            events.push([retired.month - 1, 'Full retirement starts', 'start']);
        }
    }
    if (mortgageFree?.month > 0 && !mortgageFree.relocation) events.push([mortgageFree.month, 'Mortgage clears', 'mortgage']);
    if (baseline.rows.some(row => row.relocation && row.relocation.shortfall <= 0.005)) {
        events.push([p.move, 'UK home sold and Romanian home purchased', 'mortgage']);
    }
    if (p.startingLisa > 0) events.push([p.lisaAccess, 'Lifetime ISA available', 'pension']);
    if (p.startingPension > 0 || p.workplacePension > 0 || p.monthlySipp > 0) {
        events.push([p.access, 'Private pension available', 'pension']);
    }
    const statePayment = baseline.rows.find(row => row.statePension > 0);
    if (statePayment) events.push([statePayment.month - 1, 'State Pension enters projection', 'pension']);
    events.sort(([a], [b]) => a - b);
    get('plan-events').replaceChildren(...events.filter(([month]) => month >= 0 && month <= last).map(([month, label, type]) => {
        const li = element('li');
        const button = element('button', label);
        button.type = 'button';
        button.dataset.event = type;
        button.append(element('strong', 'Age ' + age((p.age + month) / 12)));
        button.addEventListener('click', () => chart.showMonth(month, { keepView: true }));
        li.append(button);
        return li;
    }));
}

function renderFailureBreakdown(stress, p) {
    const breakdown = get('stress-breakdown');
    breakdown.hidden = !stress || stress.successes === stress.count;
    const labels = {
        bridge: 'Shortfall before private pension access',
        later: 'Shortfall after private pension access',
        budget: 'Working or Coast budget shortfall',
        mortgage: 'Mortgage balance at the horizon',
        relocation: 'Cash purchase shortfall at relocation'
    };
    const reasons = stress ? Object.entries(stress.failures)
        .filter(([, count]) => count > 0).map(([key, count]) => [labels[key], count]) : [];
    if (stress?.medianFailureMonth !== null && stress?.medianFailureMonth !== undefined) {
        reasons.push(['Typical failure age among failed paths', 'Age ' + age((p.age + stress.medianFailureMonth) / 12)]);
    }
    breakdown.replaceChildren(...reasons.map(([label, value]) => {
        const row = element('div');
        row.append(element('dt', label), element('dd', value));
        return row;
    }));
}

let previousComparison;

function renderComparison(inputs, p) {
    const key = JSON.stringify(inputs);
    if (previousComparison?.key !== key) previousComparison = { key, rows: compare(inputs) };
    const planAge = plan => plan ? 'Age ' + age((p.age + plan.start) / 12) : 'Outside plan';
    get('comparison-move-heading').hidden = !p.relocate;
    get('comparison').replaceChildren(...previousComparison.rows.map(row => {
        const tr = element('tr');
        const heading = element('th', `${row.relocate ? 'Romania move' : 'Stay UK'} · ${row.label}`);
        heading.scope = 'row';
        tr.append(heading, ...Object.keys(scenarioNames).map(key => element('td', planAge(row.plans[key]))));
        if (p.relocate) {
            const status = row.mortgageOutstanding ? 'Mortgage outstanding at horizon'
                : row.failure ? `${gbp(row.failure.shortfall)} ${row.failure.relocation?.shortfall > 0.005 ? 'purchase shortfall' : 'budget shortfall'} at age ${age((p.age + row.failure.month - 1) / 12)}`
                : row.minimumMissed ? 'Funded, below minimum retirement period' : 'Funded through horizon';
            const move = row.move;
            const amount = move ? `UK equity ${gbp(move.equity)}, costs ${gbp(move.costs)}. `
                + (move.net < 0 ? `${gbp(-move.net)} needed from ${gbp(move.available)} available. ` : `${gbp(move.net)} released to cash. `) : '';
            tr.append(element('td', amount + status));
        }
        return tr;
    }));
}

function update() {
    try {
        const inputs = {};
        for (const [key, input] of fields) {
            if (!input.validity.valid) throw new Error(`Check the value for ${input.labels[0].firstChild.textContent}.`);
            inputs[key] = input.type === 'checkbox' ? input.checked
                : input.type === 'number' ? input.valueAsNumber : input.value;
        }
        if (!riskEnabled.checked || !riskTarget.validity.valid || targetPreview?.key !== riskKey(inputs)
            || targetPreview?.plan.mode !== mode.value) targetPreview = null;
        const result = project(inputs, mode.value, targetPreview?.plan.start);
        const { p, plans, selected, baseline, work } = result;
        const opening = baseline.rows[0];
        const mortgageFree = baseline.rows.find(row => row.mortgage <= 0.005 && !(row.shortfall > 0.005));
        const planAge = plan => plan ? `Age ${age((p.age + plan.start) / 12)}` : 'Outside plan';
        const basis = targetPreview ? ' · baseline' : '';
        const cards = [
            ['full', 'Full FIRE' + basis, planAge(plans.full)],
            ['coast', 'Coast FIRE' + basis, planAge(plans.coast)],
            ['partTime', 'Barista FIRE' + basis, partTimeEnabled(p) ? planAge(plans.partTime) : 'Off'],
            ['worth', 'Net worth today', gbp(opening.netWorth)],
            ['accessible', 'Accessible assets today', gbp(opening.accessible)],
            ['equity', 'Home equity today', gbp(opening.equity)],
            ['portfolio', 'Investable assets today', gbp(opening.portfolio)],
            ['work', 'Working cash left this month', work.relocation?.shortfall > 0.005 ? 'Move unfunded' : gbp(work.surplus)],
            ['mortgage', 'Mortgage-free in projection', mortgageFree ? `Age ${age(mortgageFree.age)}` : 'Outside plan'],
            ['returns', 'Annual real return after fees', `${((p.realGrowth - 1) * 100).toFixed(2)}%`]
        ];
        renderSummary(cards, result, inputs, mortgageFree);
        const payWarning = get('pay-warning');
        payWarning.hidden = !(p.partTimeNet > 0 && p.partTimeNet === p.partTimeGross
            && p.partTimeGross * 12 > 12570);
        payWarning.textContent = 'Part-time take-home and taxable pay are the same. For ordinary UK employment above the personal allowance, deductions generally reduce take-home pay. Check these figures against an expected payslip.';
        const isaWarning = get('isa-warning');
        isaWarning.hidden = result.maxIsaDeposits <= 20000.005;
        get('isa-warning-detail').textContent = 'This projection includes up to ' + gbp(result.maxIsaDeposits)
            + ' of ISA deposits in a 12-month period in today’s pounds. The 2026/27 allowance is £20,000 per tax year. Check planned contributions and any mortgage-payment redirection.';
        get('projection-basis').hidden = !targetPreview;
        get('projection-basis-text').textContent = targetPreview
            ? 'Projection at the ' + targetPreview.target + '% search age' : '';
        let description = selected
            ? `${scenarioNames[selected.mode]} starts at age ${age(baseline.rows[selected.start].age)} with ${gbp(baseline.rows[selected.start].portfolio)} of investable assets.`
            : 'This scenario has no eligible start. The chart shows the working projection.';
        if (!baseline.success) description += baseline.mortgageOutstanding
            ? ' Mortgage debt remains at the horizon.'
            : ` The budget runs short by ${gbp(baseline.rows.at(-1).shortfall)} in the month ending at age ${age(baseline.rows.at(-1).age)}.`;
        get('plan-details').textContent = description;
        const stress = (p.monteCarlo || targetPreview) && selected ? stressTest(p, selected) : null;
        get('stress-result').textContent = stress
            ? `${stress.successes} of ${stress.count} simulated paths fund the plan and clear the mortgage at this start age. In the Stress test view, the shaded range shows the middle 80% of investable asset balances among paths still funded at each age.`
            : p.monteCarlo ? 'Stress testing needs an eligible start for the selected scenario.' : '';
        renderFailureBreakdown(stress, p);
        renderPlanEvents(result, mortgageFree);
        renderTimeline(result);
        renderMilestones(result);
        if (get('comparison-panel').open) renderComparison(inputs, p);
        get('report').hidden = false;
        get('error').hidden = true;
        chart.update({
            rows: baseline.rows.filter(row => !(row.shortfall > 0.005)),
            stress, mortgageFree: opening.mortgage > 0.005 ? mortgageFree : null,
            start: selected?.start
        });
        latestInputs = inputs;
        latestPrepared = p;
        updateRisk(p, inputs);
        saveInputs(inputs);
    } catch (error) {
        latestPrepared = null;
        currentRiskSearch = null;
        get('report').hidden = true;
        get('error').textContent = error.message;
        get('error').hidden = false;
    }
}

get('comparison-panel').addEventListener('toggle', () => {
    if (get('comparison-panel').open && latestPrepared) renderComparison(latestInputs, latestPrepared);
});

const exampleDialog = get('example-dialog');
get('load-example').addEventListener('click', () => {
    exampleDialog.returnValue = 'cancel';
    exampleDialog.showModal();
});
exampleDialog.addEventListener('close', () => {
    if (exampleDialog.returnValue !== 'load') return;
    for (const [key, input] of fields) {
        if (input.type === 'checkbox') input.checked = defaults[key];
        else input.value = defaults[key];
    }
    mode.value = 'full';
    riskEnabled.checked = false;
    riskTarget.value = 90;
    targetPreview = null;
    openExplanation = null;
    update();
    chart.setView('balances');
});
get('show-baseline').addEventListener('click', () => {
    targetPreview = null;
    update();
    chart.setView('balances');
    mode.focus();
});
let timer;
get('inputs').addEventListener('submit', event => event.preventDefault());
get('inputs').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(update, 180);
});
mode.addEventListener('change', update);
function changeRiskControls() {
    if (targetPreview) {
        targetPreview = null;
        update();
        return;
    }
    updateRisk(latestPrepared, latestInputs);
    if (latestInputs) saveInputs(latestInputs);
}

riskEnabled.addEventListener('change', changeRiskControls);
riskTarget.addEventListener('input', changeRiskControls);
riskTarget.addEventListener('change', changeRiskControls);
update();
