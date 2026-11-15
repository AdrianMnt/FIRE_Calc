'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { incomeTax } = require('./uk-tax.js');
const { prepare, project, simulate, stressTest } = require('./fire-model.js');

const neutral = {
    currentAge: 50, horizonAge: 60, startingIsa: 0, startingCash: 0, startingPension: 0,
    mortgageRemaining: 0, mortgageBase: 0, mortgageOverpay: 0, mortgageRate: 0,
    netIncome: 0, livingExpenses: 0, monthlyIsa: 0, workplacePension: 0, monthlySipp: 0,
    grossReturn: 0, fees: 0, inflation: 0, targetIncome: 0, statePensionAmount: 0
};
const fullNow = { mode: 'full', start: 0 };
const workForever = { mode: 'full', start: Infinity };
function close(actual, expected, tolerance = 0.01) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

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
