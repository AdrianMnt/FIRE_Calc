'use strict';

const { defaults, project, simulate, stressTest } = FireModel;
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
        ['startingIsa', 'ISA balance (£)'], ['startingCash', 'Cash savings (£)'],
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
        ['monthlyIsa', 'Monthly ISA contribution (£)'],
        ['workplacePension', 'Monthly gross workplace pension contribution (£)', 'Include employee and employer contributions already accounted for in payroll.'],
        ['monthlySipp', 'Monthly SIPP cost from take-home pay (£)'],
        ['sippGrossFactor', 'SIPP gross-up multiplier', 'Use 1.25 for standard relief at source, or 1 when no relief is added.']
    ]],
    ['Retirement and pensions', [
        ['targetIncome', 'Annual retirement spending excluding mortgage (£)'],
        ['overFundBuffer', 'Extra spending for eligibility test (%)'],
        ['pensionAccessAge', 'Private pension access age', 'Check your scheme rules.'],
        ['statePensionAge', 'State Pension start age'],
        ['statePensionAmount', 'Annual gross State Pension (£)', 'Enter the annual amount. Multiply a weekly forecast by 52 or a monthly amount by 12. 0 assumes no income.'],
        ['region', 'Income Tax region'],
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
                input.type = 'number';
                input.step = 'any';
                input.required = true;
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
if (['full', 'coast', 'partTime'].includes(saved.mode)) mode.value = saved.mode;
const scenarioNames = { full: 'Full FIRE', coast: 'Coast FIRE', partTime: 'Barista FIRE' };
const balanceSeries = [
    ['accessible', 'Cash and ISA', '--isa'], ['pension', 'Pension', '--pension'],
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
            && row.month !== payoff?.month && row.phase === next?.phase) continue;
        const tr = element('tr');
        const heading = element('th', age(row.age));
        heading.scope = 'row';
        tr.append(heading, element('td', next?.phase ?? row.phase ?? 'Working'));
        const balances = row.shortfall > 0.005
            ? Array(5).fill(null) : [row.cash, row.isa, row.pension, row.mortgage, row.netWorth];
        for (const value of [...balances, ...totals]) {
            tr.append(element('td', value === null ? 'Outside plan' : gbp(value)));
        }
        tableRows.push(tr);
        totals = [0, 0, 0, 0];
    }
    get('timeline').replaceChildren(...tableRows);
}

function renderMilestones(result) {
    const names = { accessible: 'Cash and ISA', pension: 'Pension', netWorth: 'Net worth' };
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
        if (key === 'partTime' && !p.partTimeNet) return ['Enter your monthly part-time take-home and taxable pay to test a reduced-hours plan.'];
        const coastPay = p.useCoastNet ? p.coastNet : p.netIncome;
        if (key === 'coast' && coastPay < p.livingExpenses) return [
            `Coast take-home pay of ${gbp(coastPay)} falls short of ${gbp(p.livingExpenses)} in monthly working expenses before any mortgage payment. Coasting requires pay to cover those bills so the investments can stay untouched.`
        ];
        return [mortgageRequired
            ? 'No mortgage-free start met the cash-flow test before this scenario’s end age. The model keeps the full-time budget and any mortgage overpayments until payoff.'
            : 'No start met the cash-flow test with these inputs. Check the working budget, retirement spending, when each income source starts and your planning horizon.'];
    }

    const rows = key === result.selected?.mode ? result.baseline.rows : simulate(p, plan, { record: true }).rows;
    const opening = rows[plan.start];
    const first = rows[plan.start + 1];
    const pensionAge = Math.max(opening.age, p.pensionAccessAge);
    const details = [
        `At age ${age(opening.age)}, you have ${gbp(opening.accessible)} in cash and ISA and ${gbp(opening.pension)} in your private pension. The eligibility test uses ${gbp(p.targetIncome * (1 + p.overFundBuffer / 100))} a year of retirement spending, plus the mortgage, through age ${age(p.horizonAge)}.`
    ];
    if (key === 'coast') {
        const retirement = rows[p.coastEnd];
        const pay = p.useCoastNet ? p.coastNet : p.netIncome;
        details.push(`You keep working until age ${age(p.coastAge)}. In the first Coast month, ${gbp(pay)} take-home covers ${gbp(p.livingExpenses)} in living costs and ${gbp(first.mortgageCost)} on the mortgage. ISA and pension contributions and mortgage overpayments stop. The model leaves any spare pay out of the portfolio.`);
        details.push(`By age ${age(p.coastAge)}, the model projects ${gbp(retirement.accessible)} in cash and ISA and ${gbp(retirement.pension)} in your private pension, using a steady ${((p.realGrowth - 1) * 100).toFixed(2)}% real annual return after fees.`);
    } else if (key === 'partTime') {
        const end = rows[p.partTimeEnd];
        details.push(`You switch to ${gbp(p.partTimeNet)} monthly take-home pay until age ${age(p.partTimeEndAge)}. Your first month draws ${gbp(first.drawn)} from the portfolio before any tax on private pension withdrawals. Full-time contributions and mortgage overpayments stop at the switch.`);
        if (end) details.push(`When the part-time pay ends, the baseline projects ${gbp(end.accessible)} in cash and ISA and ${gbp(end.pension)} in your pension. The portfolio and any pension income cover the bills from then on.`);
    } else {
        details.push(`Work income and new contributions stop immediately at this age. The first retired month uses ${gbp(first.drawn)} in gross portfolio withdrawals. Cash and ISA cover any gap until your private pension is available at age ${age(pensionAge)}.`);
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
            worth: `${gbp(opening.cash)} cash + ${gbp(opening.isa)} ISA + ${gbp(opening.pension)} pension + ${gbp(p.homeValue)} home + ${gbp(p.otherAssets)} other assets, less ${gbp(opening.mortgage)} mortgage and ${gbp(p.otherDebt)} other debt. Property and other assets are held at constant real values in the projection.`,
            accessible: `${gbp(opening.cash)} cash plus ${gbp(opening.isa)} ISA. These balances can cover spending before your private pension unlocks. Home equity stays in the property unless you separately plan to release it.`,
            work: `${gbp(p.netIncome)} take-home, less ${gbp(p.livingExpenses)} living costs, ${gbp(work.mortgageCost)} mortgage payments, ${gbp(p.monthlyIsa)} ISA savings and ${gbp(p.monthlySipp)} personal SIPP costs. The figure is after any automatic mortgage-payment redirection. Workplace pension contributions are already accounted for in payroll.`,
            mortgage: mortgageFree
                ? `${scenarioNames[mode.value]} clears the mortgage ${mortgageFree.month === 0 ? 'today' : 'at age ' + age(mortgageFree.age)}. The mortgage chart shows this payoff month. The model stops overpayments when you leave full-time work. A specified maturity collects any remaining balance in its final month.`
                : 'The selected projection ends before the mortgage is cleared. Check the budget, payments and term.',
            returns: `The model compounds a ${p.grossReturn}% nominal return, applies ${p.fees}% fees and divides by a ${p.inflation}% inflation factor. Cash is assumed to earn zero nominal interest. The baseline holds the investment return steady each year.`
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

function update() {
    try {
        const inputs = {};
        for (const [key, input] of fields) {
            if (!input.validity.valid) throw new Error(`Check the value for ${input.labels[0].firstChild.textContent}.`);
            inputs[key] = input.type === 'checkbox' ? input.checked
                : input.type === 'number' ? input.valueAsNumber : input.value;
        }
        const result = project(inputs, mode.value);
        const { p, plans, selected, baseline, work } = result;
        const opening = baseline.rows[0];
        const mortgageFree = baseline.rows.find(row => row.mortgage <= 0.005 && !(row.shortfall > 0.005));
        const planAge = plan => plan ? `Age ${age((p.age + plan.start) / 12)}` : 'Outside plan';
        const cards = [
            ['full', 'Full FIRE', planAge(plans.full)],
            ['coast', 'Coast FIRE', planAge(plans.coast)],
            ['partTime', 'Barista FIRE', p.partTimeNet > 0 ? planAge(plans.partTime) : 'Off'],
            ['worth', 'Net worth today', gbp(opening.netWorth)],
            ['accessible', 'Cash and ISA today', gbp(opening.accessible)],
            ['work', 'Working cash left this month', gbp(work.surplus)],
            ['mortgage', 'Mortgage-free in projection', mortgageFree ? `Age ${age(mortgageFree.age)}` : 'Outside plan'],
            ['returns', 'Annual real return after fees', `${((p.realGrowth - 1) * 100).toFixed(2)}%`]
        ];
        renderSummary(cards, result, inputs, mortgageFree);
        const payWarning = get('pay-warning');
        payWarning.hidden = !(p.partTimeNet > 0 && p.partTimeNet === p.partTimeGross
            && p.partTimeGross * 12 > 12570);
        payWarning.textContent = 'Part-time take-home and taxable pay are the same. For ordinary UK employment above the personal allowance, deductions generally reduce take-home pay. Check these figures against an expected payslip.';
        let description = selected
            ? `${scenarioNames[selected.mode]} starts at age ${age(baseline.rows[selected.start].age)} with ${gbp(baseline.rows[selected.start].portfolio)} in cash, ISA and pension.`
            : 'This scenario has no eligible start. The chart shows the working projection.';
        if (!baseline.success) description += baseline.mortgageOutstanding
            ? ' Mortgage debt remains at the horizon.'
            : ` The budget runs short by ${gbp(baseline.rows.at(-1).shortfall)} in the month ending at age ${age(baseline.rows.at(-1).age)}.`;
        get('plan-details').textContent = description;
        const stress = p.monteCarlo && selected ? stressTest(p, selected) : null;
        get('stress-result').textContent = stress
            ? `${stress.successes} of ${stress.count} simulated paths fund the plan and clear the mortgage at this start age. In the Stress test view, the shaded range shows the middle 80% of cash, ISA and pension balances among paths still funded at each age.`
            : p.monteCarlo ? 'Stress testing needs an eligible start for the selected scenario.' : '';
        renderTimeline(result);
        renderMilestones(result);
        get('report').hidden = false;
        get('error').hidden = true;
        chart.update({
            rows: baseline.rows.filter(row => !(row.shortfall > 0.005)),
            stress, mortgageFree: opening.mortgage > 0.005 ? mortgageFree : null,
            start: selected?.start
        });
        try {
            localStorage.setItem(storageKey, JSON.stringify({ ...inputs, mode: mode.value }));
        } catch {
            // The calculator can still run when storage is unavailable.
        }
    } catch (error) {
        get('report').hidden = true;
        get('error').textContent = error.message;
        get('error').hidden = false;
    }
}

let timer;
get('inputs').addEventListener('submit', event => event.preventDefault());
get('inputs').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(update, 180);
});
mode.addEventListener('change', update);
update();
