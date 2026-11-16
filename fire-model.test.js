'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { incomeTax } = require('./uk-tax.js');
const { prepare, project, compare, decision, simulate, stressTest, findSuccessAges, confirmSuccess } = require('./fire-model.js');

const neutral = {
    currentAge: 50, horizonAge: 60, startingIsa: 0, startingCash: 0, startingPension: 0,
    mortgageRemaining: 0, mortgageBase: 0, mortgageOverpay: 0, mortgageRate: 0, mortgageTerm: 0,
    netIncome: 0, livingExpenses: 0, monthlyIsa: 0, workplacePension: 0, monthlySipp: 0,
    grossReturn: 0, fees: 0, inflation: 0, targetIncome: 0, statePensionAmount: 0,
    partTimeNet: 0, partTimeGross: 0
};
const fullNow = { mode: 'full', start: 0 };
const workForever = { mode: 'full', start: Infinity };
const moveFixture = {
    ...neutral, relocate: true, moveAge: 50, horizonAge: 51, homeValue: 100000,
    replacementHome: 65000, saleCosts: 2000, purchaseCosts: 1000, movingCosts: 2000,
    abroadRetirement: 0, abroadHealthcare: 0, abroadLiving: 0, abroadNetIncome: 0,
    abroadInvest: 0, abroadPension: 0, abroadPartTimeNet: 0
};

function close(actual, expected, tolerance = 0.01) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('the all-in budget remains constant during and after mortgage payoff', () => {
    const p = prepare({ ...neutral, horizonAge: 51, ukBudgetIncludesMortgage: true,
        startingCash: 1200, mortgageRemaining: 300, mortgageBase: 100, targetIncome: 1200 });
    const { rows, success } = simulate(p, fullNow, { record: true });
    assert.equal(success, true);
    assert.equal(rows[1].budgetGap, 100);
    assert.equal(rows[3].mortgage, 0);
    assert.equal(rows[4].budgetGap, 100);
    assert.equal(rows.at(-1).cash, 0);
});

test('voluntary overpayments are extra and required payments above budget are funded in full', () => {
    const p = prepare({ ...neutral, horizonAge: 51, ukBudgetIncludesMortgage: true, netIncome: 175,
        livingExpenses: 150, mortgageRemaining: 1000, mortgageBase: 100, mortgageOverpay: 25,
        mortgageTerm: 0.25, targetIncome: 1800 });
    const work = simulate(p, workForever, { record: true }).rows;
    assert.equal(work[1].surplus, 0);
    assert.equal(work[2].surplus, 0);
    assert.equal(work[3].mortgageCost, 750);
    assert.equal(work[3].shortfall, 575);
});

test('mortgage rate resets once and reamortises the actual balance over the remaining term', () => {
    const p = prepare({ ...neutral, horizonAge: 51, mortgageRemaining: 1200, mortgageBase: 100,
        mortgageTerm: 1, mortgageResetMonth: 2, mortgageResetRate: 12, netIncome: 200 });
    const { rows, success } = simulate(p, workForever, { record: true });
    const scheduled = 1000 * .01 / (1 - 1.01 ** -10);
    assert.equal(success, true);
    close(rows[2].mortgage, 1000);
    close(rows[2].mortgageCost, 100);
    close(rows[3].mortgageCost, scheduled);
    close(rows[3].mortgage, 1010 - scheduled);
    close(rows[11].mortgageCost, scheduled);
    close(rows[12].mortgageCost, scheduled);
    const manual = simulate({ ...p, mortgageResetPayment: 150 }, workForever, { record: true }).rows;
    close(manual[3].mortgageCost, 150);
    assert.throws(() => prepare({ ...neutral, mortgageResetMonth: 1.5 }), /whole number/);
});

test('two UK start ages give independent whole-pound minimum incomes through the horizon', () => {
    const fixture = { ...moveFixture, startingCash: 300, horizonAge: 51, partTimeEndAge: 50.5,
        partTimeNet: 200, partTimeGross: 200, targetIncome: 1200 };
    const [now, later, firstMove, secondMove] = decision(fixture, {
        ukAge: 50, laterUkAge: 50.25, moveAge: 50.25, lowerPrice: 75000, higherPrice: 90000
    });
    assert.equal(now.minimumPay, 150);
    assert.equal(later.minimumPay, 200);
    assert.equal(firstMove.plan.mode, 'full');
    assert.equal(secondMove.plan.mode, 'full');
    assert.equal(simulate({ ...now.p, partTimeNet: 149, partTimeGross: 149 }, now.plan).success, false);
});

test('annual overpayments use available cash after regular payment, repeat, and stop after full-time work', () => {
    const p = prepare({ ...neutral, horizonAge: 53, mortgageRemaining: 10000, mortgageBase: 100,
        netIncome: 150, monthlyCash: 50, startingCash: 500, annualOverpayRate: 10,
        firstAnnualOverpayMonth: 2 });
    const working = simulate(p, workForever, { record: true }).rows;
    close(working[2].annualOverpay, 600);
    close(working[2].annualOverpayUnfunded, 380);
    close(working[2].mortgage, 9200);
    assert.equal(working[2].cash, 0);
    close(working[14].mortgage, 7400);
    close(working[14].annualOverpay, 600);
    close(working[14].annualOverpayUnfunded, 200);
    const switched = simulate(p, { mode: 'coast', start: 1 }, { record: true }).rows;
    assert.equal(switched[2].annualOverpay, 0);
    close(switched[2].cash, 550);
    assert.throws(() => prepare({ ...neutral, firstAnnualOverpayMonth: 1.5 }), /whole number/);
});

test('annual overpayments and FX-equivalent purchase costs conserve value at zero inflation', () => {
    const p = prepare({ ...moveFixture, moveAge: 50.5, mortgageRemaining: 10000,
        mortgageBase: 100, netIncome: 100, startingCash: 3000, firstAnnualOverpayMonth: 1,
        annualOverpayRate: 10 });
    const rows = simulate(p, { mode: 'full', start: 6 }, { record: true }).rows;
    close(rows[1].annualOverpay, 990);
    close(rows[1].netWorth - rows[0].netWorth, 100);
    close(rows[6].cash, 2010);
    close(rows[7].netWorth, rows[6].netWorth - 5000);
    close(rows[7].relocation.equity, 91590);
    assert.ok(compare({ ...moveFixture, mortgageRemaining: 25, annualOverpayRate: 5 })
        .some(row => row.label === 'No mortgage overpayment'));
});

test('a UK sale price override applies only at sale and changes purchase proceeds pound for pound', () => {
    const p = prepare({ ...moveFixture, moveAge: 50.5, saleHomeValue: 85000 });
    const rows = simulate(p, { mode: 'full', start: 6 }, { record: true }).rows;
    assert.equal(rows[6].equity, 100000);
    assert.equal(rows[7].relocation.equity, 85000);
    assert.equal(rows[7].cash, 15000);
    assert.equal(rows[7].equity, 65000);
    assert.equal(rows[7].netWorth, rows[6].netWorth - 20000);
});

test('Barista uses a separate UK budget and continues the stated pension credit only during work', () => {
    const p = prepare({ ...neutral, startingCash: 1000, partTimeGross: 650, partTimeNet: 600,
        partTimePension: 150, usePartTimeBudget: true, partTimeBudget: 700, targetIncome: 600,
        partTimeEndAge: 50.5, horizonAge: 51 });
    const { rows, success } = simulate(p, { mode: 'partTime', start: 0 }, { record: true });
    assert.equal(success, true);
    assert.equal(rows[1].budgetGap, 100);
    assert.equal(rows[6].cash, 400);
    assert.equal(rows[6].pension, 900);
    assert.equal(rows[7].budgetGap, 50);
    assert.equal(rows.at(-1).pension, 900);
    assert.equal(rows.at(-1).cash, 100);
});

test('fixed-date decision compares two prices without changing the timeline or forcing a common start', () => {
    const fixture = { ...moveFixture, relocate: false, moveAge: 59, horizonAge: 54,
        pensionAccessAge: 53, replacementHome: 97000, partTimeNet: 1500,
        partTimeGross: 1800, partTimeEndAge: 53, targetIncome: 24000,
        abroadRetirement: 12000, startingIsa: 6000 };
    const settings = { ukAge: 50, moveAge: 51, lowerPrice: 75000, higherPrice: 90000, realReturn: 0 };
    const [uk, low, high] = decision(fixture, settings);
    assert.equal(uk.plan.start, 0);
    assert.equal(low.plan.start, 12);
    assert.equal(uk.firstGap, 500);
    assert.equal(low.firstGap, 1000);
    assert.equal(low.availableAfterPurchase, 26000);
    assert.equal(high.availableAfterPurchase, 11000);
    assert.equal(low.bridge.monthly, 1083);
    assert.equal(high.bridge.monthly, 458);
    assert.equal(low.bridge.endAge, 53);
    assert.equal(low.failure.month, 39);
    assert.equal(fixture.replacementHome, 97000);
    const [,,unfunded] = decision(fixture, { ...settings, higherPrice: 110000 });
    assert.equal(unfunded.purchase.shortfall, 9000);
    assert.equal(unfunded.availableAfterPurchase, null);
    assert.equal(unfunded.bridge, null);
    assert.throws(() => decision(fixture, { ...settings, ukAge: 54 }), /part-time age/);
    assert.throws(() => decision(fixture, { ...settings, lowerPrice: 100000 }), /ascending order/);
});

test('fixed-date decision distinguishes phase constraints and a shortfall before the phase starts', () => {
    const fixture = { ...moveFixture, mortgageRemaining: 10000, netIncome: 500,
        livingExpenses: 600, partTimeNet: 300, partTimeGross: 500, partTimeEndAge: 50.5,
        partTimeAfterMortgage: true };
    const settings = { ukAge: 50, moveAge: 50.5, lowerPrice: 75000, higherPrice: 90000 };
    const [uk, low] = decision(fixture, settings);
    assert.equal(uk.constraint, 'mortgageGate');
    assert.equal(low.transition, undefined);
    assert.equal(low.failure.month, 1);
    assert.equal(low.failure.phase, 'Working');
    assert.equal(low.purchase, undefined);
    const [ended] = decision({ ...fixture, netIncome: 600 }, { ...settings, ukAge: 50.5 });
    assert.equal(ended.constraint, 'partTimeEnd');
});

test('fixed-date stress testing can use the same spending buffer as the decision cards', () => {
    const p = prepare({ ...neutral, horizonAge: 51, startingIsa: 12000,
        targetIncome: 12000, volatility: 0, overFundBuffer: 10 });
    assert.equal(stressTest(p, fullNow, { count: 4 }).successes, 4);
    assert.equal(stressTest(p, fullNow, { count: 4, buffered: true }).successes, 0);
});

test('Lifetime ISA stays locked until 60 and never substitutes for an earlier private pension', () => {
    const inputs = { ...neutral, currentAge: 59.75, horizonAge: 60.25, startingLisa: 4000,
        targetIncome: 12000, pensionAccessAge: 59.75, startingPension: 3000 };
    const { rows, success } = simulate(prepare(inputs), fullNow, { record: true });
    assert.equal(success, true);
    assert.equal(rows[0].accessible, 0);
    assert.equal(rows[0].portfolio, 7000);
    assert.equal(rows[2].accessible, 0);
    assert.equal(rows[3].accessible, 4000);
    assert.equal(rows[3].pension, 0);
    assert.equal(rows.at(-1).lisa, 1000);
    assert.equal(simulate(prepare({ ...inputs, startingPension: 0 }), fullNow).failureMonth, 1);
});

test('an equal UK household split applies two allowances and taxes State Pension and drawdown incrementally', () => {
    const inputs = { ...neutral, currentAge: 68, horizonAge: 69, pensionAccessAge: 57,
        startingPension: 300000, statePensionAmount: 24000, targetIncome: 36000, lumpSumAllowance: 0 };
    const first = splitHouseholdTax => simulate(prepare({ ...inputs, splitHouseholdTax }),
        fullNow, { record: true }).rows[1];
    close(first(true).drawn, 1226.25);
    close(first(true).tax, 226.25);
    close(first(false).drawn, 1488.125);
    close(first(false).tax, 488.125);
});

test('UK private pension tax uplift applies only to the taxable drawdown portion', () => {
    const p = prepare({ ...neutral, pensionAccessAge: 50, horizonAge: 51, startingPension: 50000,
        targetIncome: 6000, pensionTaxExtra: 10 });
    const first = simulate(p, fullNow, { record: true }).rows[1];
    close(first.drawn, 500 / 0.925);
    close(first.tax, 500 / 0.925 - 500);
});

test('relocation releases equity once and reduces net worth by transaction costs only', () => {
    const p = prepare({ ...moveFixture, mortgageRemaining: 25000, mortgageBase: 500,
        mortgageRate: 12, startingCash: 1000, startingLisa: 2000, startingPension: 40000 });
    const { rows } = simulate(p, fullNow, { record: true });
    assert.deepEqual(rows[1].relocation, { equity: 75000, costs: 5000, net: 5000, shortfall: 0, available: 1000 });
    assert.equal(rows[1].mortgageCost, 0);
    assert.equal(rows[1].equity, 65000);
    assert.equal(rows[1].cash, 6000);
    assert.equal(rows.at(-1).cash, 6000);
    assert.equal(rows[1].netWorth, rows[0].netWorth - 5000);
});

test('sale repays the nominal mortgage in sale-month pounds after scheduled overpayments', () => {
    const p = prepare({ ...moveFixture, moveAge: 51, horizonAge: 52, mortgageRemaining: 30000,
        mortgageBase: 400, mortgageOverpay: 100, mortgageRate: 6, inflation: 3, netIncome: 1000 });
    const { rows } = simulate(p, { mode: 'full', start: 12 }, { record: true });
    const debt = (30000 * 1.005 ** 12 - 500 * (1.005 ** 12 - 1) / .005) / 1.03;
    close(rows[12].mortgage, debt);
    close(rows[13].relocation.equity, 100000 - debt);
    assert.equal(rows[13].mortgage, 0);
});

test('relocation gap uses liquid balances only and an unaffordable purchase is atomic', () => {
    const inputs = { ...moveFixture, replacementHome: 100000, startingCash: 1000, startingIsa: 3999,
        startingLisa: 5000, startingPension: 500000, pensionAccessAge: 50 };
    const result = simulate(prepare(inputs), fullNow, { record: true });
    assert.equal(result.failureMonth, 1);
    assert.equal(result.relocationShortfall, true);
    assert.equal(result.rows[1].shortfall, 1);
    assert.equal(result.rows[1].cash, 1000);
    assert.equal(result.rows[1].isa, 3999);
    const funded = simulate(prepare({ ...inputs, startingIsa: 4000 }), fullNow, { record: true });
    assert.equal(funded.success, true);
    assert.equal(funded.rows[1].accessible, 0);
    const after60 = simulate(prepare({ ...inputs, currentAge: 60, moveAge: 60, horizonAge: 61 }),
        fullNow, { record: true });
    assert.equal(after60.rows[1].lisa, 4999);
});

test('working abroad switches contributions and budgets without using UK ISA allowance', () => {
    const p = prepare({ ...moveFixture, startingCash: 0, startingIsa: 0,
        abroadNetIncome: 1200, abroadLiving: 800, abroadHealthcare: 150, abroadInvest: 250,
        abroadPension: 200, monthlyIsa: 999, monthlyCash: 999, monthlySipp: 999,
        workplacePension: 999, redirectMortgage: true, mortgageBase: 100, mortgageRemaining: 5000 });
    const { rows, success } = simulate(p, workForever, { record: true });
    assert.equal(success, true);
    assert.equal(rows[1].isaAdded, 0);
    assert.equal(rows.at(-1).isa, 0);
    assert.equal(rows.at(-1).taxable, 3000);
    assert.equal(rows.at(-1).pension, 2400);
});

test('post-move effective tax rates apply separately to State Pension and gross drawdown', () => {
    const p = prepare({ ...moveFixture, replacementHome: 95000, pensionAccessAge: 50, statePensionAge: 50,
        startingPension: 100000, statePensionAmount: 6000, abroadRetirement: 13200, abroadHealthcare: 100,
        abroadPensionTax: 40, abroadStateTax: 20, lumpSumEnabled: true, lumpSumAmount: 10000 });
    const { rows } = simulate(p, fullNow, { record: true });
    close(rows[1].drawn, 800 / .6);
    close(rows[1].tax, 100 + 800 / .6 * .4);
    assert.equal(rows[1].cash, 0);
    assert.equal(simulate({ ...p, abroadPensionTax: 100 }, fullNow).failureMonth, 1);
});

test('UK cash earmarked for a home purchase comes from pay and stops under Coast FIRE', () => {
    const p = prepare({ ...moveFixture, moveAge: 50.5, replacementHome: 98000,
        netIncome: 500, monthlyCash: 500, abroadCoastNet: 0 });
    const working = simulate(p, workForever, { record: true });
    assert.equal(working.rows[6].cash, 3000);
    assert.equal(working.rows[7].cash, 0);
    assert.equal(working.success, true);
    assert.equal(simulate(p, { mode: 'coast', start: 0 }).relocationShortfall, true);
});

test('start at relocation can satisfy the Barista mortgage gate using a funded sale', () => {
    const result = project({ ...moveFixture, moveAge: 50.5, mortgageRemaining: 10000,
        partTimeAfterMortgage: true, partTimeEndAge: 51, abroadPartTimeNet: 100 });
    assert.equal(result.plans.partTime.start, 6);
});

test('custom milestones sort and deduplicate, with a LISA crossing at its access age', () => {
    const result = project({ ...neutral, currentAge: 59.5, horizonAge: 61,
        startingLisa: 100, customMilestones: '100, 50,50, 500' });
    assert.deepEqual(result.milestones.filter(item => item.metric === 'accessible')
        .map(({ target, month }) => [target, month]), [[50, 6], [100, 6], [500, null]]);
    for (const value of ['5,,7', '0', '1e5', '-2', '1.001']) {
        assert.throws(() => prepare({ ...neutral, customMilestones: value }), /milestone/);
    }
});

test('return comparison uses exact real rates with independent location and sensitivity cases', () => {
    const inputs = { ...moveFixture, moveAge: 51, horizonAge: 53, startingIsa: 10000,
        replacementHome: 106000, inflation: 3, grossReturn: 3, statePensionAmount: 100,
        mortgageRemaining: 1, mortgageOverpay: 1, netIncome: 10 };
    const rows = compare(inputs);
    const selected = (relocate, label) => rows.find(row => row.relocate === relocate && row.label === label);
    close(selected(true, '3% real').failure.shortfall, 700);
    close(selected(true, '4% real').failure.shortfall, 600);
    close(selected(true, '6% real').failure.shortfall, 400);
    assert.equal(selected(false, '3% real').move, undefined);
    assert.equal(selected(false, '3% real').failure, null);
    assert.ok(selected(true, 'No State Pension'));
    assert.ok(selected(true, 'Private pension tax +10 pp'));
    assert.ok(selected(false, 'No mortgage overpayment'));
    assert.throws(() => compare({ ...inputs, moveAge: 49 }), /relocation age/);
});

test('a failed stochastic purchase remains a failed path for later start ages', () => {
    const p = prepare({ ...moveFixture, moveAge: 50.5, startingIsa: 10000, replacementHome: 105000,
        volatility: 45, abroadPartTimeNet: 100, partTimeEndAge: 51 });
    const count = 40;
    const seed = 21;
    const plan = { mode: 'partTime', start: 6 };
    const stress = stressTest(p, plan, { count, seed });
    assert.ok(stress.successes > 0 && stress.successes < count);
    assert.equal(stress.failures.relocation, count - stress.successes);
    const run = target => {
        const search = findSuccessAges(p, target, { count, seed });
        let step = search.next();
        while (!step.done) step = search.next();
        return step.value.partTime;
    };
    assert.equal(run(100), null);
    const found = run(100 * stress.successes / count);
    assert.equal(found.start, 6);
    assert.equal(found.successes, stress.successes);
});

test('2026/27 UK and Scottish tax by hand, including allowance taper', () => {
    assert.equal(incomeTax(12570, 'rest'), 0);
    assert.equal(incomeTax(60000, 'rest'), 37700 * .2 + 9730 * .4);
    assert.equal(incomeTax(110000, 'rest'), 37700 * .2 + (110000 - 7570 - 37700) * .4);
    assert.equal(incomeTax(150000, 'rest'), 37700 * .2 + 87440 * .4 + 24860 * .45);
    const scotland = 3967 * .19 + 12989 * .20 + 14136 * .21 + 6338 * .42;
    close(incomeTax(50000, 'scotland'), scotland);
});

test('real return compounds geometrically and cash with no interest loses purchasing power', () => {
    const p = prepare({ ...neutral, horizonAge: 51, grossReturn: 8, fees: .5, inflation: 3,
        startingIsa: 10000, startingCash: 10300, startingPension: 20000 });
    const end = simulate(p, fullNow, { record: true }).rows.at(-1);
    close(end.isa, 10000 * 1.08 * .995 / 1.03);
    close(end.pension, 20000 * 1.08 * .995 / 1.03);
    close(end.cash, 10000);
});

test('mortgage uses nominal amortisation and real reporting with a partial final payment', () => {
    const p = prepare({ ...neutral, horizonAge: 52, mortgageRemaining: 1200, mortgageBase: 110,
        mortgageRate: 12, inflation: 3, netIncome: 200, redirectMortgage: true });
    const { rows } = simulate(p, workForever, { record: true });
    const nominalAfterTen = 1200 * 1.01 ** 10 - 110 * (1.01 ** 10 - 1) / .01;
    close(rows[10].mortgage, nominalAfterTen / 1.03 ** (10 / 12));
    const nominalAfterEleven = nominalAfterTen * 1.01 - 110;
    const finalPayment = nominalAfterEleven * 1.01;
    assert.ok(finalPayment < 110);
    close(rows[12].mortgageCost, finalPayment / 1.03 ** (11 / 12));
    close(rows[12].isa, (110 - finalPayment) / 1.03);
    assert.equal(rows[12].mortgage, 0);
});

test('a debt-free start never generates mortgage redirection', () => {
    const p = prepare({ ...neutral, mortgageBase: 1000, mortgageOverpay: 900,
        redirectMortgage: true, netIncome: 2000, monthlyIsa: 100 });
    close(simulate(p, workForever, { record: true }).rows.at(-1).isa, 12000);
});

test('maturity balloon and outstanding mortgage affect eligibility', () => {
    const p = prepare({ ...neutral, horizonAge: 51, mortgageRemaining: 10000, mortgageTerm: 1,
        mortgageBase: 100, startingIsa: 9999 });
    const result = simulate(p, fullNow, { record: true });
    assert.equal(result.failureMonth, 12);
    close(result.rows.at(-1).mortgageCost, 8900);
    close(result.rows.at(-1).shortfall, 1);
    assert.equal(simulate(prepare({ ...p, mortgageTerm: 0 }), fullNow).mortgageOutstanding, true);
});

test('immediate FIRE requires the full bridge even with an ample locked pension', () => {
    const plan = { ...neutral, currentAge: 56, horizonAge: 58, startingPension: 500000,
        targetIncome: 12000 };
    assert.equal(project({ ...plan, startingIsa: 12000 }).plans.full.start, 0);
    assert.equal(project({ ...plan, startingIsa: 11999 }).plans.full.start, 1);
    const p = prepare({ ...plan, startingIsa: 11999, volatility: 0 });
    const stress = stressTest(p, fullNow, { count: 5 });
    assert.equal(stress.successes, 0);
    assert.equal(stress.ranges[12].surviving, 0);
});

test('State Pension is taxable and surplus can pay the mortgage', () => {
    const p = prepare({ ...neutral, currentAge: 68, horizonAge: 69, statePensionAmount: 24000,
        mortgageRemaining: 12000, mortgageBase: 1000, targetIncome: 9600 });
    const row = simulate(p, fullNow, { record: true }).rows[1];
    close(row.tax, (24000 - 12570) * .2 / 12);
    close(row.cash, 2000 - 190.5 - 1000 - 800);
    assert.equal(row.shortfall, 0);
});

test('pension net withdrawal grosses up correctly against State Pension and existing pay', () => {
    const p = prepare({ ...neutral, currentAge: 68, horizonAge: 69, startingPension: 50000,
        statePensionAmount: 12570, targetIncome: 36570 });
    const row = simulate(p, fullNow, { record: true }).rows[1];
    close(row.drawn, 2000 / .85);
    close(row.tax, 2000 / .85 - 2000);
    const part = prepare({ ...neutral, currentAge: 68, horizonAge: 69, partTimeEndAge: 69,
        startingPension: 50000, partTimeNet: 3000, partTimeGross: 5000, targetIncome: 48000 });
    const payRow = simulate(part, { mode: 'partTime', start: 0 }, { record: true }).rows[1];
    close(payRow.drawn, 1000 / .70);
    close(payRow.tax, 1000 / .70 - 1000);
});

test('tax can make a retirement infeasible despite enough pre-tax pension', () => {
    const plan = { ...neutral, currentAge: 67, horizonAge: 68, startingPension: 24000,
        statePensionAge: 67, statePensionAmount: 12570, targetIncome: 36570 };
    assert.equal(project(plan).plans.full.start, 2);
    const p = prepare({ ...plan, startingPension: 29000, volatility: 0 });
    assert.equal(simulate(p, fullNow).success, true);
    assert.equal(stressTest(p, fullNow, { count: 8 }).successes, 8);
});

test('lump sum transfers value once at access and respects the nominal allowance', () => {
    const p = prepare({ ...neutral, currentAge: 56, horizonAge: 59, startingPension: 60000,
        inflation: 10, lumpSumEnabled: true, lumpSumAmount: 20000, lumpSumAllowance: 5500 });
    const { rows } = simulate(p, fullNow, { record: true, growthAt: () => 1 });
    assert.equal(rows[12].cash, 0);
    close(rows[13].pension, 55000);
    close(rows[13].cash, 5000 / 1.1 ** (1 / 12));
    close(rows[24].cash, 5000 / 1.1);
    assert.equal(rows[24].pension, rows[13].pension);
});

test('optional lump sum leaves a taxable drawdown portion', () => {
    const p = prepare({ ...neutral, currentAge: 68, horizonAge: 69, startingPension: 80000,
        statePensionAmount: 12570, targetIncome: 36570, lumpSumEnabled: true, lumpSumAmount: 1000 });
    const row = simulate(p, fullNow, { record: true }).rows[1];
    // £1,000 lump pays half the £2,000 gap. Remaining draw is from crystallised funds.
    close(row.drawn, 1000 + 1000 / .8);
    close(row.tax, 250);
});

test('Coast stops contributions and rejects an unfunded working budget', () => {
    const inputs = { ...neutral, currentAge: 40, horizonAge: 52, coastAge: 50,
        netIncome: 2000, livingExpenses: 1500, startingIsa: 22000, monthlyIsa: 500,
        targetIncome: 12000 };
    const result = project(inputs, 'coast');
    assert.equal(result.plans.coast.start, 4);
    assert.equal(result.baseline.rows[4].isa, 24000);
    assert.equal(result.baseline.rows[120].isa, 24000);
    assert.equal(result.baseline.rows[120].phase, 'Coasting');
    assert.equal(result.baseline.rows[121].phase, 'Retired');
    assert.equal(project({ ...inputs, livingExpenses: 2100, startingIsa: 100000 }).plans.coast, null);
});

test('part-time income stops at the specified age and can bridge to full retirement', () => {
    const inputs = { ...neutral, horizonAge: 53, startingIsa: 24000, targetIncome: 12000,
        partTimeNet: 1000, partTimeGross: 1100, partTimeEndAge: 51 };
    const result = project(inputs, 'partTime');
    assert.equal(result.plans.full.start, 12);
    assert.equal(result.plans.partTime.start, 0);
    assert.equal(result.baseline.rows[12].isa, 24000);
    assert.equal(result.baseline.rows[13].isa, 23000);
    assert.equal(result.baseline.rows.at(-1).isa, 0);
    assert.equal(project({ ...inputs, startingIsa: 23999 }).plans.partTime, null);
});

test('contributions require a funded working budget and SIPP relief is credited once', () => {
    const inputs = { ...neutral, netIncome: 1000, livingExpenses: 800,
        monthlyIsa: 100, monthlySipp: 100, sippGrossFactor: 1.25, workplacePension: 150 };
    const row = simulate(prepare(inputs), workForever, { record: true }).rows[1];
    assert.equal(row.isa, 100);
    assert.equal(row.pension, 275);
    const bad = simulate(prepare({ ...inputs, livingExpenses: 801 }), workForever, { record: true });
    assert.equal(bad.failureMonth, 1);
    assert.equal(bad.rows[1].pension, 0);
});

test('safety buffer changes eligibility without inflating actual withdrawals', () => {
    const inputs = { ...neutral, horizonAge: 51, startingIsa: 12000, targetIncome: 12000,
        netIncome: 1400, monthlyIsa: 1000 };
    assert.equal(project(inputs).plans.full.start, 0);
    const result = project({ ...inputs, overFundBuffer: 10 });
    assert.equal(result.plans.full.start, 1);
    assert.equal(result.baseline.rows[2].drawn, 1000);
});

test('property equity is wealth but cannot fund retirement; milestones use first crossings', () => {
    const inputs = { ...neutral, horizonAge: 51, startingIsa: 99000, startingPension: 100000,
        homeValue: 250000, otherAssets: 7000, otherDebt: 10000, mortgageRemaining: 20000,
        mortgageBase: 0, monthlyIsa: 1000, netIncome: 1000, targetIncome: 150000 };
    const result = project(inputs);
    assert.equal(result.plans.full, null);
    assert.equal(result.baseline.rows[0].netWorth, 426000);
    const hit = metric => result.milestones.find(x => x.metric === metric && x.target === 100000).month;
    assert.equal(hit('accessible'), 1);
    assert.equal(hit('pension'), 0);
    assert.equal(hit('netWorth'), 0);
});

test('stress test is seeded and retains assets of funded paths only', () => {
    const p = prepare({ ...neutral, currentAge: 55, horizonAge: 59, targetIncome: 12000,
        startingIsa: 24000, startingPension: 50000, volatility: 25 });
    const result = stressTest(p, fullNow, { count: 100, seed: 83 });
    assert.deepEqual(stressTest(p, fullNow, { count: 100, seed: 83 }), result);
    assert.ok(result.successes > 0 && result.successes < 100);
    assert.equal(result.ranges[48].surviving, result.successes);
});

test('invalid inputs and rounding to month boundaries', () => {
    assert.throws(() => prepare({ ...neutral, horizonAge: 50 }));
    assert.throws(() => prepare({ ...neutral, grossReturn: -100 }));
    assert.throws(() => prepare({ ...neutral, startingCash: -1 }));
    assert.throws(() => prepare({ ...neutral, partTimeNet: 2000, partTimeGross: 1000 }));
    const p = prepare({ ...neutral, currentAge: 56.9166667, horizonAge: 58 });
    assert.equal(p.access, 1);
});

test('a separate Coast income must cover working costs and the regular mortgage', () => {
    const inputs = { ...neutral, currentAge: 40, horizonAge: 52, coastAge: 50,
        netIncome: 2000, livingExpenses: 1500, startingIsa: 24000, monthlyIsa: 100,
        mortgageRemaining: 1200, mortgageBase: 100, targetIncome: 12000, useCoastNet: true };
    assert.equal(project({ ...inputs, coastNet: 1600 }).plans.coast.start, 0);
    assert.equal(project({ ...inputs, coastNet: 1599 }).plans.coast.start, 12);
    assert.equal(project({ ...inputs, coastNet: 1499 }).plans.coast, null);
    assert.equal(project({ ...inputs, useCoastNet: false, coastNet: 0 }).plans.coast.start, 0);
});

test('optional mortgage-free gates delay only their own scenario until actual payoff', () => {
    const inputs = { ...neutral, currentAge: 50, horizonAge: 55, coastAge: 53, partTimeEndAge: 53,
        startingIsa: 120000, targetIncome: 12000, netIncome: 2300, livingExpenses: 1000,
        mortgageRemaining: 2400, mortgageBase: 100, mortgageOverpay: 100,
        partTimeNet: 1000, partTimeGross: 1100 };
    const first = project(inputs).plans;
    assert.equal(first.coast.start, 0);
    assert.equal(first.partTime.start, 0);
    const coastOnly = project({ ...inputs, coastAfterMortgage: true }, 'coast');
    assert.equal(coastOnly.plans.full.start, first.full.start);
    assert.equal(coastOnly.plans.coast.start, 12);
    assert.equal(coastOnly.plans.partTime.start, 0);
    assert.equal(coastOnly.baseline.rows[12].mortgage, 0);
    assert.equal(coastOnly.baseline.rows[12].phase, 'Working');
    assert.equal(coastOnly.baseline.rows[13].phase, 'Coasting');
    const partOnly = project({ ...inputs, partTimeAfterMortgage: true }).plans;
    assert.equal(partOnly.coast.start, 0);
    assert.equal(partOnly.partTime.start, 12);
    const tooEarly = project({ ...inputs, partTimeAfterMortgage: true, partTimeEndAge: 51 }).plans;
    assert.equal(tooEarly.partTime, null);
    const debtFree = project({ ...inputs, mortgageRemaining: 0, coastAfterMortgage: true,
        partTimeAfterMortgage: true }).plans;
    assert.equal(debtFree.coast.start, 0);
    assert.equal(debtFree.partTime.start, 0);
});

function targetAges(p, target, options) {
    const search = findSuccessAges(p, target, options);
    let step = search.next();
    while (!step.done) step = search.next();
    return step.value;
}

test('target ages match a brute-force search and reported stress scores', () => {
    const p = prepare({ ...neutral, currentAge: 55, horizonAge: 58, coastAge: 57,
        partTimeEndAge: 57, partTimeNet: 500, partTimeGross: 700, startingIsa: 12000,
        startingPension: 25000, startingCash: 500, monthlyIsa: 300, netIncome: 2500,
        mortgageRemaining: 1800, mortgageBase: 150, mortgageOverpay: 150,
        coastAfterMortgage: true, partTimeAfterMortgage: true, targetIncome: 12000, volatility: 25 });
    const options = { count: 28, seed: 61 };
    const target = 90;
    const results = targetAges(p, target, options);
    for (const mode of ['full', 'coast', 'partTime']) {
        const limit = mode === 'full' ? p.duration : 24;
        const eligible = Array.from({ length: limit }, (_, start) => start)
            .filter(start => mode === 'full' || start >= 6);
        const first = eligible.find(start =>
            stressTest(p, { mode, start }, options).successes >= Math.ceil(options.count * target / 100));
        assert.equal(results[mode]?.start, first);
        if (first !== undefined) {
            assert.equal(results[mode].successes, stressTest(p, { mode, start: first }, options).successes);
        }
    }
    assert.ok(results.full);
});

test('target search reports missing dates and validates the requested percentage', () => {
    const p = prepare({ ...neutral, currentAge: 50, horizonAge: 51, coastAge: 50.5,
        targetIncome: 12000, volatility: 0 });
    assert.deepEqual(targetAges(p, 100, { count: 10 }), { full: null, coast: null, partTime: null });
    assert.throws(() => targetAges(p, 0), RangeError);
    assert.throws(() => targetAges(p, 101), RangeError);
});

test('mortgage-free switches exclude otherwise successful Coast and Barista starts', () => {
    const inputs = { ...neutral, currentAge: 50, horizonAge: 55, coastAge: 53, partTimeEndAge: 53,
        startingIsa: 120000, targetIncome: 12000, netIncome: 2300, livingExpenses: 1000,
        mortgageRemaining: 2400, mortgageBase: 100, mortgageOverpay: 100,
        partTimeNet: 1000, partTimeGross: 1100, volatility: 0 };
    const options = { count: 10 };
    const open = targetAges(prepare(inputs), 90, options);
    const gated = targetAges(prepare({ ...inputs, coastAfterMortgage: true, partTimeAfterMortgage: true }), 90, options);
    assert.equal(open.coast.start, 0);
    assert.equal(open.partTime.start, 0);
    assert.equal(gated.coast.start, 12);
    assert.equal(gated.partTime.start, 12);
    assert.equal(gated.full.start, open.full.start);
});

test('stress test classifies failures consistently and counts the first failed month', () => {
    const fixtures = [
        [{ currentAge: 56, horizonAge: 58, startingIsa: 999, targetIncome: 12000 }, fullNow, 'bridge', 1],
        [{ currentAge: 57, horizonAge: 58, startingPension: 999, targetIncome: 12000 }, fullNow, 'later', 1],
        [{ currentAge: 57, horizonAge: 59, coastAge: 58, livingExpenses: 1 }, { mode: 'coast', start: 0 }, 'budget', 1],
        [{ currentAge: 57, horizonAge: 58, mortgageRemaining: 1000 }, fullNow, 'mortgage', 12]
    ];
    for (const [inputs, plan, reason, month] of fixtures) {
        const p = prepare({ ...neutral, ...inputs });
        const report = stressTest(p, plan, { count: 7 });
        assert.equal(report.successes, 0);
        assert.equal(report.failures[reason], 7);
        assert.equal(Object.values(report.failures).reduce((a, b) => a + b), 7);
        assert.equal(report.medianFailureMonth, month);
    }
});

test('fresh-path confirmation equals the same seed in the stress engine', () => {
    const p = prepare({ ...neutral, currentAge: 55, horizonAge: 60, startingIsa: 26000,
        startingPension: 80000, volatility: 30, targetIncome: 12000 });
    const checked = confirmSuccess(p, fullNow, { count: 173 });
    assert.equal(checked.count, 173);
    assert.equal(checked.successes,
        stressTest(p, fullNow, { count: 173, seed: 2246822519 }).successes);
    assert.notEqual(checked.successes, stressTest(p, fullNow, { count: 173 }).successes);
});

test('target preview runs at its chosen age and retains the baseline date', () => {
    const config = { ...neutral, currentAge: 55, horizonAge: 58, startingIsa: 40000, targetIncome: 12000 };
    const result = project(config, 'full', 7);
    assert.equal(result.plans.full.start, 0);
    assert.equal(result.selected.start, 7);
    assert.equal(result.baseline.rows[7].phase, 'Working');
    assert.equal(result.baseline.rows[8].phase, 'Retired');
    assert.equal(result.baseline.rows[7].portfolio, 40000);
});

test('rolling ISA deposits include payment redirection but exclude growth and opening balance', () => {
    const config = { ...neutral, currentAge: 40, horizonAge: 42, monthlyIsa: 1500,
        netIncome: 3000, mortgageRemaining: 9000, mortgageBase: 750,
        redirectMortgage: true, startingIsa: 100000, grossReturn: 10, targetIncome: 10000000 };
    const high = project(config);
    assert.equal(high.selected, null);
    assert.equal(high.baseline.rows[12].isaAdded, 1500);
    assert.equal(high.baseline.rows[13].isaAdded, 2250);
    assert.equal(high.maxIsaDeposits, 27000);
    assert.equal(project({ ...config, redirectMortgage: false }).maxIsaDeposits, 18000);
});

test('the fictional defaults fund the working budget and demonstrate all three plans', () => {
    const result = project({});
    assert.ok(result.work.surplus > 0);
    assert.ok(Object.values(result.plans).every(Boolean));
    assert.ok(result.maxIsaDeposits < 20000);
    assert.ok(result.baseline.success);
});

test('cash interest compounds in nominal terms and is independent of market volatility', () => {
    const p = prepare({ ...neutral, horizonAge: 51, startingCash: 19200, cashInterest: 4,
        inflation: 2.5, grossReturn: -10, volatility: 30 });
    const r = simulate(p, fullNow, { record: true, growthAt: () => 0.5 });
    close(r.rows.at(-1).cash, 19200 * 1.04 / 1.025);
    const stress = stressTest(p, fullNow, { count: 17 });
    assert.equal(stress.ranges.at(-1).low, stress.ranges.at(-1).high);
    close(stress.ranges.at(-1).low, 19200 * 1.04 / 1.025);
});

test('minimum full retirement applies after Coast and Barista end and before the horizon', () => {
    const config = { ...neutral, horizonAge: 55, coastAge: 53, partTimeEndAge: 53,
        partTimeNet: 1000, partTimeGross: 1200, startingIsa: 120000, targetIncome: 12000,
        volatility: 0 };
    const options = { count: 8 };
    const boundary = project({ ...config, minimumRetiredYears: 2 });
    assert.equal(boundary.plans.coast.start, 0);
    assert.equal(boundary.plans.partTime.start, 0);
    const tooShort = project({ ...config, minimumRetiredYears: 2 + 1 / 12 });
    assert.equal(tooShort.plans.coast, null);
    assert.equal(tooShort.plans.partTime, null);
    assert.equal(targetAges(tooShort.p, 90, options).coast, null);
    assert.equal(targetAges(tooShort.p, 90, options).partTime, null);
    const nearHorizon = { ...config, startingIsa: 1000 };
    assert.equal(project(nearHorizon).plans.full.start, 59);
    assert.equal(project({ ...nearHorizon, minimumRetiredYears: 1 }).plans.full, null);
    assert.equal(targetAges(prepare({ ...nearHorizon, minimumRetiredYears: 1 }), 90, options).full, null);
});
