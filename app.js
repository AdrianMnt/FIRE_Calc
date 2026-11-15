'use strict';

const { defaults, project, stressTest } = FireModel;
const get = id => document.getElementById(id);
const storageKey = 'pro-fire-simulator-state-v2';
const pounds = new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0
});
const compactPounds = new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1
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
        ['statePensionAmount', 'Annual gross State Pension (£)', 'Enter your personal forecast. 0 assumes no income.'],
        ['region', 'Income Tax region'],
        ['lumpSumAllowance', 'Remaining tax-free lump sum allowance (£)'],
        ['lumpSumEnabled', 'Move a one-off tax-free lump sum into cash'],
        ['lumpSumAmount', 'Requested lump sum (£)', 'Taken at pension access during part-time work or retirement, subject to the remaining allowance.']
    ]],
    ['Coast and part-time FIRE', [
        ['coastAge', 'Coast FIRE retirement age', 'Keep working until this age. Current take-home pay must cover working costs and the mortgage. Contributions and overpayments stop when coasting begins.'],
        ['partTimeNet', 'Part-time monthly take-home pay (£)', '0 disables part-time FIRE.'],
        ['partTimeGross', 'Part-time monthly taxable pay (£)', 'Enter before Income Tax and after any salary sacrifice.'],
        ['partTimeEndAge', 'Age part-time work ends']
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
const scenarioNames = { full: 'Full FIRE', coast: 'Coast FIRE', partTime: 'Part-time FIRE' };
const series = [
    ['accessible', 'Cash and ISA', '--isa'], ['pension', 'Pension', '--pension'],
    ['mortgage', 'Mortgage', '--mortgage'], ['netWorth', 'Net worth', '--worth']
];
let chartData;

function renderChart() {
    if (!chartData || get('report').hidden) return;
    const { rows, stress } = chartData;
    const chart = get('chart');
    const width = chart.clientWidth;
    const height = chart.clientHeight;
    if (width < 100 || height < 100) return;
    const ratio = window.devicePixelRatio || 1;
    chart.width = Math.round(width * ratio);
    chart.height = Math.round(height * ratio);
    const ctx = chart.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const colour = variable => css.getPropertyValue(variable).trim();
    ctx.scale(ratio, ratio);
    const left = 59;
    const right = width - 22;
    const top = 14;
    const bottom = height - 31;
    const first = rows[0].month;
    const length = Math.max(1, rows.at(-1).month - first);
    const values = rows.flatMap(row => series.map(([key]) => row[key]));
    const bands = stress?.ranges ?? [];
    const low = Math.min(0, ...values);
    const high = Math.max(low + 1, ...values, ...bands.map(band => band.high ?? 0));
    const x = month => left + (month - first) / length * (right - left);
    const y = value => bottom - (value - low) / (high - low) * (bottom - top);
    ctx.font = '12px system-ui';
    ctx.fillStyle = colour('--muted');
    ctx.strokeStyle = colour('--line');
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const value = low + i * (high - low) / 4;
        ctx.beginPath();
        ctx.moveTo(left, y(value));
        ctx.lineTo(right, y(value));
        ctx.stroke();
        ctx.fillText(compactPounds.format(value), left - 6, y(value) + 4);
    }
    ctx.textAlign = 'center';
    const ticks = Math.min(5, rows.length - 1);
    for (let step = 0; step <= ticks; step++) {
        const row = rows[Math.round(step * (rows.length - 1) / Math.max(1, ticks))];
        ctx.fillText(age(row.age), x(row.month), height - 8);
    }
    if (stress) {
        const plotted = rows.filter(row => bands[row.month].surviving > 0);
        if (plotted.length) {
            ctx.beginPath();
            plotted.forEach(row => ctx.lineTo(x(row.month), y(bands[row.month].high)));
            plotted.reverse().forEach(row => ctx.lineTo(x(row.month), y(bands[row.month].low)));
            ctx.closePath();
            ctx.fillStyle = colour('--band');
            ctx.fill();
        }
    }
    for (const [key, , variable] of series) {
        ctx.strokeStyle = colour(variable);
        ctx.lineWidth = 2;
        ctx.beginPath();
        rows.forEach(row => ctx.lineTo(x(row.month), y(row[key])));
        ctx.stroke();
    }
}

function renderTimeline(result) {
    const { rows } = result.baseline;
    const tableRows = [];
    let totals = [0, 0, 0, 0];
    for (const row of rows) {
        const [drawn, state, tax, shortfall] = totals;
        totals = [drawn + (row.drawn ?? 0), state + (row.statePension ?? 0),
            tax + (row.tax ?? 0), shortfall + (row.shortfall ?? 0)];
        const next = rows[row.month + 1];
        if (row.month % 12 !== 0 && row.month !== result.selected?.start
            && row.phase === next?.phase) continue;
        const tr = element('tr');
        const heading = element('th', age(row.age));
        heading.scope = 'row';
        tr.append(heading, element('td', next?.phase ?? row.phase ?? 'Working'));
        const balances = row.shortfall > 0.005
            ? Array(5).fill(null) : [row.cash, row.isa, row.pension, row.mortgage, row.netWorth];
        for (const value of [...balances, ...totals]) {
            tr.append(element('td', value === null ? '—' : gbp(value)));
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
        for (const milestone of result.milestones.filter(item => item.metric === key)) {
            const row = element('li');
            const status = milestone.month === 0 ? 'Reached' : milestone.month === null
                ? '—' : `Age ${age((result.p.age + milestone.month) / 12)}`;
            const badge = element('span', status);
            if (milestone.month === 0) badge.className = 'achieved';
            if (milestone.month === null) badge.setAttribute('aria-label', 'Outside projection');
            row.append(element('span', gbp(milestone.target)), badge);
            list.append(row);
        }
        section.append(element('h3', label), list);
        return section;
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
        const result = project(inputs, mode.value);
        const { p, plans, selected, baseline, work } = result;
        const opening = baseline.rows[0];
        const mortgageFree = baseline.rows.find(row => row.mortgage <= 0.005 && !(row.shortfall > 0.005));
        const planAge = plan => plan ? `Age ${age((p.age + plan.start) / 12)}` : 'Outside plan';
        const cards = [
            ['Full FIRE', planAge(plans.full)], ['Coast FIRE', planAge(plans.coast)],
            ['Part-time FIRE', p.partTimeNet > 0 ? planAge(plans.partTime) : 'Off'],
            ['Net worth today', gbp(opening.netWorth)], ['Cash and ISA today', gbp(opening.accessible)],
            ['Working cash left this month', gbp(work.surplus)],
            ['Mortgage-free in projection', mortgageFree ? `Age ${age(mortgageFree.age)}` : 'Outside plan'],
            ['Annual real return after fees', `${((p.realGrowth - 1) * 100).toFixed(2)}%`]
        ];
        get('summary').replaceChildren(...cards.map(([label, value]) => {
            const card = element('div');
            card.append(element('dt', label), element('dd', value));
            return card;
        }));
        let description = selected
            ? `${scenarioNames[selected.mode]} starts at age ${age(baseline.rows[selected.start].age)} with ${gbp(baseline.rows[selected.start].portfolio)} in cash, ISA and pension.`
            : 'This scenario has no eligible start. The chart shows the working projection.';
        if (!baseline.success) description += baseline.mortgageOutstanding
            ? ' Mortgage debt remains at the horizon.'
            : ` The budget runs short by ${gbp(baseline.rows.at(-1).shortfall)} in the month ending at age ${age(baseline.rows.at(-1).age)}.`;
        get('plan-details').textContent = description;
        const stress = p.monteCarlo && selected ? stressTest(p, selected) : null;
        get('stress-result').textContent = stress
            ? `${stress.successes} of ${stress.count} simulated paths fund the plan and clear the mortgage. The shaded range shows the middle 80% of cash, ISA and pension balances among paths still funded at each age.`
            : p.monteCarlo ? 'Stress testing needs an eligible start for the selected scenario.' : '';
        const legend = stress ? [...series, ['', 'Simulated portfolio range', '--band']] : series;
        get('legend').replaceChildren(...legend.map(([, label, variable]) => {
            const item = element('span');
            const swatch = element('span');
            swatch.className = 'swatch';
            swatch.style.background = `var(${variable})`;
            item.append(swatch, document.createTextNode(label));
            return item;
        }));
        renderTimeline(result);
        renderMilestones(result);
        chartData = { rows: baseline.rows.filter(row => !(row.shortfall > 0.005)), stress };
        get('report').hidden = false;
        get('error').hidden = true;
        renderChart();
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
window.addEventListener('resize', renderChart);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderChart);
update();
