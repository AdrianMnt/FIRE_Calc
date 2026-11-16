'use strict';

const { defaults, exampleDefaults, restoreSettings, project, compare, decision, partTimeEnabled,
    simulate, projectionDetails, workingBudget, dependentSettings, settingIsActive,
    stressTest, findSuccessAges, countSuccessSteps, confirmSuccess } = FireModel;
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
        ['mortgageRate', 'Current mortgage rate (%)', 'Nominal annual rate divided by 12.'],
        ['mortgageTerm', 'Years to mortgage maturity', '0 uses payments until payoff when you enter the payment yourself. A term pays any remainder at maturity.'],
        ['estimateMortgagePayment', 'Calculate the mortgage payment', 'Uses the balance, rate and remaining term.'],
        ['mortgageBase', 'Actual regular monthly payment (£)', 'Enter the scheduled payment before overpayments.'],
        ['mortgageOverpay', 'Monthly overpayment while working (£)'],
        ['annualOverpayRate', 'Annual mortgage overpayment (% of balance)', 'Paid from cash savings only, while working. Check your lender’s limit and allocation.'],
        ['firstAnnualOverpayMonth', 'Months to first annual overpayment', '1 applies after the first regular monthly payment. The annual payment repeats every 12 months.'],
        ['mortgageResetMonth', 'Months until the mortgage rate changes', '0 keeps the current rate for the whole term.'],
        ['mortgageResetRate', 'Mortgage rate after the change (%)'],
        ['mortgageResetPayment', 'New regular monthly payment (£)', 'Leave at 0 to recalculate over the remaining term. With no term, the old payment continues.'],
        ['redirectMortgage', 'Direct freed mortgage payments to the ISA', 'Uses spare working income after the stated budget and contributions.']
    ]],
    ['Working budget', [
        ['netIncome', 'Monthly take-home income (£)', 'After payroll pension contributions. Include any net pension receipts already in the budget.'],
        ['livingExpenses', 'Monthly household spending (£)'],
        ['ukBudgetIncludesMortgage', 'UK spending budgets include the regular mortgage', 'Applies to working, part-time and retirement. Total spending stays at the entered budget after payoff. Voluntary overpayments are extra.'],
        ['investUkSurplus', 'Invest the remaining working surplus', 'After any cash, ISA and personal pension amounts you choose below. The remainder goes to a general investment account.'],
        ['monthlyCash', 'Monthly cash set-aside (£)', 'Optional allocation for an emergency fund, move or annual mortgage overpayment.'],
        ['monthlyIsa', 'Monthly amount directed to the ISA (£)', 'Optional allocation. Include it within your available savings.'],
        ['workplacePension', 'Monthly gross workplace pension contribution (£)', 'Include employee and employer contributions already accounted for in payroll.'],
        ['monthlySipp', 'Monthly SIPP cost from take-home pay (£)'],
        ['sippGrossFactor', 'SIPP gross-up multiplier', 'Use 1.25 for standard relief at source, or 1 when no relief is added.']
    ]],
    ['Retirement and pensions', [
        ['linkUkRetirementBudget', 'Use the same spending in UK retirement as while working'],
        ['targetIncome', 'UK retirement spending (£)'],
        ['retirementBudgetPeriod', 'Retirement spending frequency'],
        ['minimumRetiredYears', 'Minimum years of full retirement', '0 uses the planning horizon alone. Enter 20, for example, to require 20 years with no work income before the horizon.'],
        ['overFundBuffer', 'Extra spending for eligibility test (%)'],
        ['pensionAccessAge', 'Private pension access age', 'Check your scheme rules.'],
        ['statePensionAmount', 'Gross State Pension forecast (£)', 'Use the combined amount for the household. 0 assumes no income.'],
        ['statePensionPeriod', 'State Pension forecast frequency'],
        ['statePensionAge', 'State Pension start age'],
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
        ['partTimeNet', 'UK household take-home while part-time (£/month)', 'Enter pay after Income Tax, National Insurance and payroll deductions. 0 disables part-time FIRE.'],
        ['estimatePartTimeGross', 'Estimate taxable pay from take-home', 'Uses standard employee Income Tax and National Insurance. Use your own figure for unequal pay, self-employment or other deductions.'],
        ['partTimeGross', 'UK household taxable pay while part-time (£/month)', 'Enter before Income Tax and after any salary sacrifice.'],
        ['partTimeEndAge', 'Age part-time work ends'],
        ['partTimePension', 'Monthly gross workplace pension while part-time (£)', 'Enter the amount credited to the pension. Part-time take-home should already reflect any employee contribution.'],
        ['usePartTimeBudget', 'Use a separate UK part-time budget'],
        ['partTimeBudget', 'Monthly UK part-time spending (£)', 'Used only when the option above is checked.'],
        ['partTimeAfterMortgage', 'Start Barista FIRE only after the mortgage is paid off']
    ]],
    ['Relocation', [
        ['relocate', 'Model sale of the UK home and a cash purchase at the destination'],
        ['moveAge', 'Age at relocation'],
        ['replacementHome', 'Destination home price for the timeline (£ equivalent)', 'The comparison cards have their own two editable prices.'],
        ['saleHomeValue', 'Expected UK sale price in today’s pounds (£)', '0 uses the opening home value in real pounds. Enter a lower or higher value to test the sale price.'],
        ['saleCosts', 'UK sale and mortgage exit costs (£)', 'Include agent, legal and early repayment charges.'],
        ['purchaseCosts', 'Destination purchase costs (£ equivalent)'],
        ['movingCosts', 'Moving, FX and setup costs (£ equivalent)'],
        ['abroadLiving', 'Monthly living costs after the move (£ equivalent)'],
        ['linkAbroadRetirementBudget', 'Use the same living costs in retirement after the move'],
        ['abroadRetirement', 'Retirement spending after the move (£ equivalent)'],
        ['abroadRetirementBudgetPeriod', 'Destination retirement spending frequency'],
        ['abroadHealthcare', 'Additional monthly healthcare after the move (£ equivalent)', 'Added in every phase. Include healthcare here or in base spending.'],
        ['abroadNetIncome', 'Full-time monthly take-home after the move (£ equivalent)'],
        ['linkAbroadCoastPay', 'Use the same destination pay while coasting'],
        ['abroadCoastNet', 'Coast monthly take-home after the move (£ equivalent)'],
        ['abroadPartTimeNet', 'Part-time monthly take-home after the move (£ equivalent)'],
        ['useFixedAbroadInvest', 'Set a fixed monthly investment after moving', 'By default, the calculator uses take-home pay minus living costs and healthcare.'],
        ['abroadInvest', 'Fixed monthly investment after moving (£ equivalent)', 'Use this to model investing only part of the available budget.'],
        ['saveAbroadSurplusAsCash', 'Keep the calculated surplus in cash', 'The default invests it outside the UK ISA.'],
        ['abroadPension', 'Monthly gross pension contribution while working after the move (£ equivalent)', 'Uses the shared pension pot. Take-home pay should already reflect employee contributions.'],
        ['abroadPensionTax', 'Effective tax on gross private pension after the move (%)', 'Editable assumption for all private withdrawals after the move.'],
        ['abroadStateTax', 'Effective tax on gross State Pension after the move (%)', 'Editable planning assumption.']
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
            || localStorage.getItem('pro-fire-simulator-state-v1'));
    } catch {
        return null;
    }
}

const saved = restoreSettings(savedInputs());
const fields = new Map();
const optionalAmounts = new Set([
    'mortgageOverpay', 'annualOverpayRate', 'mortgageResetMonth', 'mortgageResetPayment',
    'monthlyCash', 'monthlyIsa', 'workplacePension', 'monthlySipp', 'statePensionAmount',
    'partTimeNet', 'partTimePension', 'abroadHealthcare', 'abroadPension'
]);
const periods = [['monthly', 'Monthly'], ['annual', 'Annual'], ['weekly', 'Weekly']];
const selectOptions = {
    region: [['rest', 'England, Wales or Northern Ireland'], ['scotland', 'Scotland']],
    statePensionPeriod: periods,
    retirementBudgetPeriod: periods.slice(0, 2),
    abroadRetirementBudgetPeriod: periods.slice(0, 2)
};
const destinationWorkKeys = new Set([
    'abroadNetIncome', 'linkAbroadCoastPay', 'abroadCoastNet', 'abroadPartTimeNet',
    'useFixedAbroadInvest', 'abroadInvest', 'saveAbroadSurplusAsCash', 'abroadPension'
]);
for (const [title, specs] of groups) {
    const section = element('details');
    section.open = title === groups[0][0];
    section.dataset.settings = title;
    section.append(element('summary', title));
    let employment;
    for (const [key, name, help] of specs) {
        if (destinationWorkKeys.has(key) && !employment) {
            employment = element('details');
            employment.className = 'optional-settings';
            employment.append(element('summary', 'Employment and savings after moving'));
            section.append(employment);
        }
        const label = element('label');
        let input;
        const value = saved[key] ?? defaults[key];
        if (selectOptions[key]) {
            input = element('select');
            for (const [value, text] of selectOptions[key]) {
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
                    input.required = !optionalAmounts.has(key);
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
        (destinationWorkKeys.has(key) ? employment : section).append(label);
        fields.set(key, input);
    }
    if (employment) employment.append(budgetOutput('destination-savings'));
    if (title === 'Working budget') section.append(budgetOutput('uk-savings'));
    if (title === 'Retirement and pensions') section.append(budgetOutput('uk-retirement-budget'));
    if (title === 'Relocation') section.append(budgetOutput('destination-retirement-budget'));
    if (title === 'Home and mortgage') section.append(budgetOutput('calculated-mortgage'));
    if (title === 'Coast and Barista FIRE') section.append(budgetOutput('calculated-taxable-pay'));
    if (title === 'Returns and stress test') section.append(budgetOutput('calculated-real-return'));
    get('inputs').append(section);
}

function budgetOutput(id) {
    const output = element('output');
    output.id = id;
    output.className = 'budget-output';
    return output;
}

function fieldValue(input) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type !== 'number') return input.value;
    return input.value === '' && optionalAmounts.has(input.id) ? 0 : input.valueAsNumber;
}

function refreshDependentInputs() {
    for (const key of Object.keys(dependentSettings)) {
        const input = fields.get(key);
        input.disabled = !settingIsActive(key, driver => fieldValue(fields.get(driver)));
        input.labels[0].hidden = input.disabled;
    }
}

const mode = get('mode');
const riskEnabled = get('risk-enabled');
const riskTarget = get('risk-target');
riskEnabled.checked = saved.riskEnabled === true;
const decisionFields = {
    uk: get('decision-uk'), ukLater: get('decision-uk-later'), includeMove: get('decision-include-move'),
    move: get('decision-move'), low: get('decision-low'),
    high: get('decision-high'), realReturn: get('decision-return'), stress: get('decision-stress')
};
const decisionDefaults = { uk: '', ukLater: '', includeMove: true, move: '', low: 80000, high: 110000,
    realReturn: '', stress: false };
function resetDecision(values = {}) {
    for (const [key, input] of Object.entries(decisionFields)) {
        const value = values[key] ?? decisionDefaults[key];
        if (input.type === 'checkbox') input.checked = value === true;
        else input.value = value;
    }
}
resetDecision(saved.decision);

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
    let totals = [0, 0, 0, 0, 0];
    for (const row of rows) {
        const [overpay, drawn, state, tax, shortfall] = totals;
        totals = [overpay + (row.annualOverpay ?? 0), drawn + (row.drawn ?? 0), state + (row.statePension ?? 0),
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
        totals = [0, 0, 0, 0, 0];
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
        if (key === 'partTime' && !partTimeEnabled(p)) return ['Enter monthly part-time take-home to test a reduced-hours plan.'];
        const coastPay = p.useCoastNet ? p.coastNet : p.netIncome;
        if (key === 'coast' && !p.relocate && coastPay < p.livingExpenses) return [
            `Coast take-home pay of ${gbp(coastPay)} falls short of ${gbp(p.livingExpenses)} in the monthly working budget. Coasting requires pay to cover those bills so the investments can stay untouched.`
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
        `At age ${age(opening.age)}, you have ${gbp(opening.accessible)} in accessible assets and ${gbp(opening.pension)} in your private pension. The eligibility test accounts for your budget, mortgage and spending buffer through age ${age(p.horizonAge)}.`
    ];
    if (key === 'coast') {
        const retirement = rows[p.coastEnd];
        const pay = first.abroad ? p.abroadCoastNet : p.useCoastNet ? p.coastNet : p.netIncome;
        const costs = first.abroad ? p.abroadLiving + p.abroadHealthcare : p.livingExpenses;
        details.push(`You keep working until age ${age(p.coastAge)}. In the first Coast month, ${gbp(pay)} take-home covers a ${gbp(costs)} spending budget. The mortgage payment is ${gbp(first.mortgageCost)}${p.ukBudgetIncludesMortgage && !first.abroad ? ' and is included in the budget' : ''}. ISA and pension contributions and mortgage overpayments stop. The model leaves any spare pay out of the portfolio.`);
        details.push(`By age ${age(p.coastAge)}, the model projects ${gbp(retirement.accessible)} in accessible assets and ${gbp(retirement.pension)} in your private pension, using a steady ${((p.realGrowth - 1) * 100).toFixed(2)}% real annual return after fees.`);
    } else if (key === 'partTime') {
        const end = rows[p.partTimeEnd];
        details.push(`You switch to ${gbp(first.abroad ? p.abroadPartTimeNet : p.partTimeNet)} monthly take-home pay at the start and work until age ${age(p.partTimeEndAge)}. Your first month draws ${gbp(first.drawn)} from the portfolio before any tax on private pension withdrawals. Full-time contributions and mortgage overpayments stop at the switch.`);
        if (end) details.push(`When the part-time pay ends, the baseline projects ${gbp(end.accessible)} in accessible assets and ${gbp(end.pension)} in your pension. The portfolio and any pension income cover the bills from then on.`);
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
            work: work.availableToSave === undefined ? 'The first month stops at the relocation purchase shortfall.'
                : `${gbp(work.availableToSave)} is available after living costs, mortgage payments and any personal pension contributions. The projection adds ${gbp(work.isaAdded)} to the ISA, ${gbp(work.cashSaved)} to cash and ${gbp(work.investedOutsideIsa)} to other investments.`,
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
let fixedPreview = false;

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
                : name === 'partTime' && !partTimeEnabled(p) ? 'Off' : 'No qualifying age';
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
            decision: Object.fromEntries(Object.entries(decisionFields)
                .map(([key, input]) => [key, input.type === 'checkbox' ? input.checked : input.value])),
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
        events.push([p.move, 'UK home sold and replacement home purchased', 'mortgage']);
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

function renderSavingsAssumptions(p, work) {
    const uk = get('uk-savings');
    const destination = get('destination-savings');
    const mortgage = get('calculated-mortgage');
    get('uk-retirement-budget').textContent = 'UK retirement budget ' + gbp(p.targetIncome / 12) + ' per month '
        + (p.ukBudgetIncludesMortgage ? 'including the mortgage.' : 'plus any mortgage payment.');
    if (p.statePensionAmount > 0) get('uk-retirement-budget').append(' Entered State Pension forecast '
        + gbp(p.statePensionAmount / 12) + ' gross per month.');
    get('destination-retirement-budget').textContent = 'Retirement after moving uses '
        + gbp(p.abroadRetirement / 12 + p.abroadHealthcare) + ' per month including healthcare.';
    get('calculated-real-return').textContent = 'Real annual investment return after fees and inflation '
        + ((p.realGrowth - 1) * 100).toFixed(2) + '%.';
    get('calculated-taxable-pay').textContent = p.estimatePartTimeGross && p.partTimeNet > 0
        ? 'Estimated monthly taxable pay ' + gbp(p.partTimeGross) + '. Used for tax on pension income during part-time work.' : '';
    mortgage.textContent = p.mortgageRemaining === 0 ? 'No outstanding mortgage.'
        : (p.estimateMortgagePayment ? 'Estimated scheduled payment ' : 'Entered scheduled payment ')
            + gbp(p.mortgageBase) + ' per month before overpayments.';
    uk.textContent = work.shortfall > 0.005 ? 'The first working month is short by ' + gbp(work.shortfall)
        + '. Take-home required for the entered budget and allocations is ' + gbp(p.netIncome + work.shortfall) + '.'
        : gbp(work.availableToSave) + ' available in the first working month. '
            + gbp(work.isaAdded) + ' to the ISA, ' + gbp(work.cashSaved) + ' to cash and '
            + gbp(work.investedOutsideIsa) + ' to other investments.';
    if (work.surplus > 0.005) uk.append(' ' + gbp(work.surplus) + ' stays outside the projection.');
    const budget = workingBudget(p, { abroad: true, working: true });
    destination.textContent = budget.remainder < -0.005
        ? 'The destination working budget is short by ' + gbp(-budget.remainder) + ' per month.'
        : p.useFixedAbroadInvest
            ? gbp(budget.planned) + ' per month invested from ' + gbp(budget.available) + ' available.'
            : gbp(budget.automatic) + ' per month from take-home pay after living costs and healthcare. '
                + (p.saveAbroadSurplusAsCash ? 'Added to cash.' : 'Invested outside the ISA.');
}

let previousDecision;
let comparisonStress;

function runComparisonStress(tasks) {
    if (!tasks.length) return;
    const run = { index: 0 };
    comparisonStress = run;
    function checkSome() {
        if (comparisonStress !== run) return;
        const deadline = performance.now() + 16;
        do {
            const task = tasks[run.index];
            const step = task.steps.next();
            if (step.done) {
                task.output.textContent = step.value.successes + ' / ' + step.value.count;
                run.index++;
                if (run.index === tasks.length) {
                    comparisonStress = null;
                    return;
                }
            }
        } while (performance.now() < deadline);
        setTimeout(checkSome, 0);
    }
    setTimeout(checkSome, 0);
}

function decisionCard(result, tasks) {
    const { p, transition, purchase, failure, constraint } = result;
    const section = element('section');
    section.className = 'decision-card';
    const uk = result.plan.mode === 'partTime';
    section.dataset.location = uk ? 'uk' : 'relocate';
    const startAge = age((p.age + result.plan.start) / 12);
    const label = uk ? 'Part-time at ' + startAge : gbp(p.replacementHome) + ' home';
    const constraintLabels = {
        pay: 'Enter part-time take-home pay',
        partTimeEnd: 'Part-time work already ends by this age',
        mortgageGate: 'Mortgage-free requirement not met',
        minimumYears: 'Minimum retirement period not met'
    };
    let status = 'Funded to age ' + age(p.horizonAge);
    if (constraint) status = constraintLabels[constraint];
    else if (failure) {
        const failedAge = age((p.age + failure.month - 1) / 12);
        const kind = !transition ? 'Working budget shortfall'
            : failure.relocation?.shortfall > 0.005 ? 'Purchase shortfall' : 'Spending shortfall';
        status = kind + ' at ' + failedAge;
    } else if (result.mortgageOutstanding) status = 'Mortgage still due at the horizon';
    const headline = element('p', status);
    headline.className = 'decision-status';
    headline.dataset.funded = String(result.success);
    const timing = uk ? 'Work until age ' + age(p.partTimeEndAge) : 'Move at age ' + startAge;
    section.append(element('h4', label), element('p', timing), headline);

    const figures = [];
    if (transition) {
        if (purchase) figures.push(['UK equity at sale', gbp(purchase.equity)],
            ['Sale, purchase and move costs', gbp(purchase.costs)],
            [purchase.net < 0 ? 'Savings needed for purchase' : 'Cash released by move', gbp(Math.abs(purchase.net))],
            ['Available after the purchase', result.availableAfterPurchase === null ? 'Purchase unfunded' : gbp(result.availableAfterPurchase)]);
        else if (uk) figures.push(['Accessible at switch', gbp(transition.accessible)],
            ['Mortgage at switch', gbp(transition.mortgage)]);
        if (result.firstGap != null) figures.push([
            result.firstGap < -0.005 ? 'First month surplus' : 'First month spending gap',
            gbp(Math.abs(result.firstGap))
        ]);
    }
    if (result.minimumPay !== null) {
        const difference = p.partTimeNet - result.minimumPay;
        const comparison = difference === 0 ? 'Matches the entered take-home'
            : gbp(Math.abs(difference)) + (difference > 0 ? ' below' : ' above') + ' the entered take-home';
        figures.unshift(['Minimum monthly take-home', gbp(result.minimumPay), 'minimum-pay', comparison]);
    }
    if (result.bridge) figures.push(['Monthly budget through age ' + age(result.bridge.endAge),
        gbp(result.bridge.monthly)]);
    if (failure) figures.push(['First unfunded amount', gbp(failure.shortfall)]);
    if (decisionFields.stress.checked && !constraint) {
        const output = element('span', 'Checking market paths…');
        tasks.push({ output, steps: countSuccessSteps(p, result.plan, { buffered: true }) });
        figures.push(['Funded at entered pay and spending', output]);
    }
    const list = element('dl');
    for (const [name, value, kind, note] of figures) {
        const row = element('div');
        if (kind) row.className = kind;
        const detail = element('dd');
        detail.append(value);
        if (note) detail.append(element('small', note));
        row.append(element('dt', name), detail);
        list.append(row);
    }
    section.append(list);
    const preview = element('button', 'View projection');
    preview.type = 'button';
    preview.className = 'decision-link';
    preview.setAttribute('aria-label', 'View projection for ' + label + ' at age ' + startAge);
    preview.addEventListener('click', () => showFixedProjection(result, label, startAge, status));
    section.append(preview);
    return section;
}

function refreshDecisionInputs() {
    get('decision-edit-move').hidden = !decisionFields.includeMove.checked;
    for (const field of [decisionFields.move, decisionFields.low, decisionFields.high]) {
        field.disabled = !decisionFields.includeMove.checked;
        field.labels[0].hidden = field.disabled;
    }
}

function renderDecision(inputs, p) {
    const error = get('decision-error');
    const cards = get('decision-cards');
    const mortgage = get('decision-mortgage');
    const basis = get('decision-assumptions');
    try {
        refreshDecisionInputs();
        if (Object.values(decisionFields).some(input => !input.disabled && input.validity.badInput)) {
            throw new Error('Enter a valid number for each age and price.');
        }
        decisionFields.uk.placeholder = String(p.age / 12);
        const moveDefault = p.moveAge < p.currentAge || p.moveAge >= p.horizonAge ? p.age / 12 : p.moveAge;
        decisionFields.move.placeholder = String(moveDefault);
        const includeRelocation = decisionFields.includeMove.checked;
        const moveAge = includeRelocation && decisionFields.move.value !== '' ? decisionFields.move.valueAsNumber : moveDefault;
        decisionFields.ukLater.placeholder = includeRelocation ? String(moveAge) : 'Optional';
        const options = {
            ukAge: decisionFields.uk.value === '' ? p.age / 12 : decisionFields.uk.valueAsNumber,
            laterUkAge: decisionFields.ukLater.value === '' ? (includeRelocation ? moveAge : null) : decisionFields.ukLater.valueAsNumber,
            includeRelocation, moveAge,
            lowerPrice: decisionFields.low.valueAsNumber, higherPrice: decisionFields.high.valueAsNumber,
            realReturn: decisionFields.realReturn.value === '' ? null : Number(decisionFields.realReturn.value)
        };
        const key = JSON.stringify([inputs, options, decisionFields.stress.checked]);
        if (previousDecision === key && error.hidden) return;
        comparisonStress = null;
        const tasks = [];
        const results = decision(inputs, options);
        const realRate = (results[0].p.realGrowth - 1) * 100;
        basis.textContent = realRate.toFixed(2) + '% annual real return · Plan through age ' + age(p.horizonAge);
        const groups = [
            ['Stay in the UK', results.filter(result => result.plan.mode === 'partTime')],
            ['Relocate and retire', results.filter(result => result.plan.mode === 'full')]
        ];
        cards.replaceChildren(...groups.filter(([, plans]) => plans.length).map(([title, plans]) => {
            const group = element('section');
            group.className = 'decision-group';
            const list = element('div');
            list.className = 'decision-cards';
            list.append(...plans.map(result => decisionCard(result, tasks)));
            group.append(element('h3', title), list);
            return group;
        }));
        const move = results.find(result => result.plan.mode === 'full');
        mortgage.hidden = !move || (move.annualOverpayment === 0 && move.unfundedAnnualOverpayment === 0);
        mortgage.textContent = !move ? '' : 'Before the move, cash savings fund ' + gbp(move.annualOverpayment)
            + ' in annual mortgage overpayments. Planned amounts that cash could not cover total '
            + gbp(move.unfundedAnnualOverpayment) + '.';
        error.hidden = true;
        previousDecision = key;
        runComparisonStress(tasks);
    } catch (problem) {
        comparisonStress = null;
        error.textContent = problem.message;
        error.hidden = false;
        mortgage.hidden = true;
        basis.textContent = '';
        cards.replaceChildren();
    }
}

let previousComparison;

function renderComparison(inputs, p) {
    const key = JSON.stringify(inputs);
    if (previousComparison?.key !== key) previousComparison = { key, rows: compare(inputs) };
    const planAge = plan => plan ? 'Age ' + age((p.age + plan.start) / 12) : 'Outside plan';
    get('comparison-move-heading').hidden = !p.relocate;
    get('comparison').replaceChildren(...previousComparison.rows.map(row => {
        const tr = element('tr');
        const heading = element('th', `${row.relocate ? 'Relocate' : 'Stay UK'} · ${row.label}`);
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

function findMortgageFree(rows) {
    return rows.find(row => row.mortgage <= 0.005 && !(row.shortfall > 0.005));
}

function renderProjection(result, { description = '', basis = '', buffered = false, runStress = false } = {}) {
    const { p, selected, baseline } = result;
    const fundedRows = baseline.rows.filter(row => !(row.shortfall > 0.005));
    const mortgageFree = findMortgageFree(fundedRows);
    const opening = selected && fundedRows[selected.start];
    get('projection-basis').hidden = !basis;
    get('projection-basis-text').textContent = basis;
    mode.disabled = fixedPreview;
    if (!description) {
        description = opening
            ? `${scenarioNames[selected.mode]} starts at age ${age(opening.age)} with ${gbp(opening.portfolio)} of investable assets.`
            : selected ? 'The steady-return projection ends before the chosen start.'
                : 'This scenario has no eligible start. The chart shows the working projection.';
        if (!baseline.success) description += baseline.mortgageOutstanding
            ? ' Mortgage debt remains at the horizon.'
            : ` The budget runs short by ${gbp(baseline.rows.at(-1).shortfall)} in the month ending at age ${age(baseline.rows.at(-1).age)}.`;
    }
    get('plan-details').textContent = description;
    const stress = runStress && selected ? stressTest(p, selected, { buffered }) : null;
    get('stress-result').textContent = stress
        ? `${stress.successes} of ${stress.count} simulated paths fund the plan and clear the mortgage at this start age. In the Stress test view, the shaded range shows the middle 80% of investable assets among still-funded paths.`
        : runStress ? 'Stress testing needs an eligible start for the selected scenario.' : '';
    renderFailureBreakdown(stress, p);
    renderPlanEvents(result, mortgageFree);
    renderTimeline(result);
    renderMilestones(result);
    chart.update({
        rows: fundedRows, stress, mortgageFree: fundedRows[0].mortgage > 0.005 ? mortgageFree : null,
        start: opening ? selected.start : undefined
    });
}

function showFixedProjection(result, label, startAge, status) {
    fixedPreview = true;
    targetPreview = null;
    const projection = projectionDetails(result.p, result.plan, result.run);
    renderProjection(projection, {
        basis: 'Selected comparison · ' + label,
        description: 'Age ' + startAge + ' switch. ' + status + '. This projection uses the comparison return and spending buffer.',
        buffered: true,
        runStress: decisionFields.stress.checked && !result.constraint
    });
    chart.setView('balances');
    get('show-baseline').focus();
    get('projection-basis').scrollIntoView({ block: 'nearest' });
}

function update() {
    try {
        refreshDependentInputs();
        const inputs = {};
        for (const [key, input] of fields) {
            const number = input.type === 'number';
            if (!input.validity.valid) throw new Error(`Check the value for ${input.labels[0].firstChild.textContent}.`);
            const value = fieldValue(input);
            inputs[key] = number && input.disabled && !Number.isFinite(value) ? defaults[key] : value;
        }
        if (!riskEnabled.checked || !riskTarget.validity.valid || targetPreview?.key !== riskKey(inputs)
            || targetPreview?.plan.mode !== mode.value) targetPreview = null;
        const result = project(inputs, mode.value, targetPreview?.plan.start);
        const { p, plans, baseline, work } = result;
        fixedPreview = false;
        const opening = baseline.rows[0];
        const mortgageFree = findMortgageFree(baseline.rows);
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
        renderSavingsAssumptions(p, result.ukWork);
        renderDecision(inputs, p);
        renderSummary(cards, result, inputs, mortgageFree);
        const payWarning = get('pay-warning');
        payWarning.hidden = p.estimatePartTimeGross || !(p.partTimeNet > 0 && p.partTimeNet === p.partTimeGross
            && p.partTimeGross * 12 > 12570);
        payWarning.textContent = 'Part-time take-home and taxable pay are the same. For ordinary UK employment above the personal allowance, deductions generally reduce take-home pay. Check these figures against an expected payslip.';
        const isaWarning = get('isa-warning');
        isaWarning.hidden = result.maxIsaDeposits <= 20000.005;
        get('isa-warning-detail').textContent = 'This projection includes up to ' + gbp(result.maxIsaDeposits)
            + ' of ISA deposits in a 12-month period in today’s pounds. The 2026/27 allowance is £20,000 per tax year. Check planned contributions and any mortgage-payment redirection.';
        if (get('comparison-panel').open) renderComparison(inputs, p);
        get('report').hidden = false;
        get('error').hidden = true;
        renderProjection(result, {
            basis: targetPreview ? 'Projection at the ' + targetPreview.target + '% search age' : '',
            runStress: p.monteCarlo || !!targetPreview
        });
        latestInputs = inputs;
        latestPrepared = p;
        updateRisk(p, inputs);
        saveInputs(inputs);
    } catch (error) {
        latestPrepared = null;
        currentRiskSearch = null;
        comparisonStress = null;
        previousDecision = null;
        for (const id of ['uk-savings', 'destination-savings', 'calculated-mortgage', 'calculated-taxable-pay', 'calculated-real-return',
            'uk-retirement-budget', 'destination-retirement-budget']) get(id).textContent = '';
        get('report').hidden = true;
        get('error').textContent = error.message;
        get('error').hidden = false;
    }
}

get('comparison-panel').addEventListener('toggle', () => {
    if (get('comparison-panel').open && latestPrepared) renderComparison(latestInputs, latestPrepared);
});

for (const [button, key] of [['decision-edit', 'partTimeNet'], ['decision-edit-move', 'purchaseCosts']]) {
    get(button).addEventListener('click', () => {
        const field = fields.get(key);
        field.closest('details').open = true;
        field.focus();
    });
}
get('decision-form').addEventListener('submit', event => event.preventDefault());
let decisionTimer;
get('decision-form').addEventListener('input', () => {
    refreshDecisionInputs();
    clearTimeout(decisionTimer);
    decisionTimer = setTimeout(() => {
        if (!latestPrepared) return;
        if (fixedPreview) {
            update();
            return;
        }
        renderDecision(latestInputs, latestPrepared);
        saveInputs(latestInputs);
    }, 180);
});

const exampleDialog = get('example-dialog');
get('load-example').addEventListener('click', () => {
    exampleDialog.returnValue = 'cancel';
    exampleDialog.showModal();
});
exampleDialog.addEventListener('close', () => {
    if (exampleDialog.returnValue !== 'load') return;
    for (const [key, input] of fields) {
        if (input.type === 'checkbox') input.checked = exampleDefaults[key];
        else input.value = exampleDefaults[key];
    }
    resetDecision();
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
    refreshDependentInputs();
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
