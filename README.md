# Pro FIRE Simulator & Advisor Tools

A single-page financial planning tool for exploring a personal FIRE (Financial Independence, Retire Early) journey in a realistic, flexible way. The simulator models your savings, mortgage, pension, withdrawals, and retirement timing using a simple but thoughtful engine that works in real terms (today’s pounds) and can optionally run Monte Carlo stress tests.

This project is designed for people who want to:
- estimate when they could reach FIRE,
- see how mortgage overpayments affect the timeline,
- test whether their plan is robust under market volatility,
- compare different savings and withdrawal strategies,
- understand how pensions, state pension, and inflation affect the plan.

---

## What this tool does

The app calculates a long-term financial trajectory from your current age to age 90. It estimates:
- when you might reach FIRE,
- when you might become mortgage-free,
- how much wealth you could have at FIRE,
- how safe your withdrawal strategy is,
- whether your plan is likely to hold up under changing market conditions.

It uses a deterministic baseline model and, when enabled, a Monte Carlo simulation to stress-test the plan across many market scenarios.

---

## Key features

### 1. Real-terms planning
All major financial figures are displayed in today’s purchasing power, which helps you understand the real impact of inflation over time.

### 2. FIRE and mortgage forecasting
The tool estimates:
- FIRE age,
- years until FIRE,
- mortgage freedom age,
- portfolio value at FIRE,
- portfolio growth across the years.

### 3. Withdrawal planning
You can model a target post-FIRE income and see how sustainable that withdrawal rate is relative to your accumulated assets.

### 4. Monte Carlo stress testing
Enabling the stress test runs 200 simulated market paths to see how often the plan survives under different return scenarios.

### 5. Timeline views
You can switch between:
- a chart view,
- a table view,
- an insights view.

---

## How to use it

###  Open the HTML file directly
1. Open the file in your browser. (or by clicking here: https://adrianmnt.github.io/FIRE_Calc/)
2. Adjust the inputs on the left side.
3. Watch the summary cards and charts update automatically.

---

## Main interface layout

### Top summary cards
These show the current headline results:
- Unallocated Working Cash: your monthly surplus or deficit based on income and expenses.
- Target FIRE Age: when the engine thinks you could retire.
- Mortgage Freedom: when the mortgage may be cleared.
- Assets at FIRE: peak portfolio value reached at FIRE.
- Plan Safety (SORR): Monte Carlo success rate when enabled.
- Safe Withdrawal Rate: your planned withdrawal rate versus a traditional 4% benchmark.
- Real Return Est.: estimated real return after inflation.

### Left-hand controls
The left panel contains four groups of inputs.

---

## Input sections explained

### 1. Profile & Assets
This section sets your starting position.

- Current Age: your current age, which affects the time horizon.
- Starting ISA: your current ISA balance.
- Starting SIPP: your current pension balance.

These values form the foundation of the simulation.

### 2. Home & Mortgage
This section models your mortgage.

- Mortgage Balance: remaining mortgage principal.
- Base Monthly Payment: the regular mortgage payment.
- Interest Rate: the mortgage interest rate.
- Monthly Overpay: extra monthly payments made while working.

The simulator assumes that overpayments stop once FIRE is reached and then redirects that cash flow into your ISA, helping you model the transition from mortgage acceleration to investment growth.

### 3. Income & Strategy
This section covers your income and contributions.

- Net Income: monthly take-home pay.
- Working Expenses: monthly living expenses while working.
- Monthly ISA Addition: monthly contributions to the ISA.
- Workplace Pension: monthly workplace pension contributions.
- SIPP Addition: additional pension contributions.
- State Pension Age: when the state pension starts.
- Annual State Pension: the annual state pension amount in today’s pounds.
- Lump Sum at Pension Age: optional 25% tax-free lump sum.
- Tax Drag Applied to SIPP Only: toggles whether tax drag is applied to SIPP withdrawals.

This section is important because the simulator’s success depends not only on your assets but also on how much you save and how much you spend.

### 4. Advisor Upgrades
These are the more advanced planning settings.

- Base Post-FIRE Goal: your target annual spending in today’s pounds.
- Tax & Healthcare Drag Buffer: a buffer added to the goal to reflect retirement costs.
- Over-Fund Buffer (Safety): increases the required savings target so the engine delays FIRE more conservatively.
- Gross Return %: assumed portfolio growth rate.
- Inflation %: assumed inflation rate.
- Stress Test (SORR): turns on Monte Carlo simulation.

These controls let you simulate both optimistic and cautious scenarios.

---

## Output views

### Lifetime Trajectory chart
Shows portfolio growth over time.

- Blue line/area: ISA balance.
- Green line/area: SIPP/pension balance.
- Red dashed line: mortgage balance.
- Optional Monte Carlo paths show a range of possible outcomes.

### Timeline Data table
Shows annual or yearly step data for:
- age,
- ISA balance,
- SIPP balance,
- mortgage balance,
- total assets,
- withdrawals,
- state pension,
- phase/notes.

This is useful if you want to inspect the plan in a more detailed numerical form.

### Key Milestones
Shows practical insights such as:
- FIRE target age,
- mortgage freedom age,
- SWR analysis,
- pension access note,
- stress test result.

---

## How to interpret the results

### FIRE age
This is the age at which the simulator believes your plan becomes viable for retirement based on your target spending and savings assumptions.

### Mortgage freedom
This is when the mortgage is projected to be fully cleared.

### Safe Withdrawal Rate (SWR)
This is the withdrawal rate implied by your target spending relative to your portfolio at FIRE.

General interpretation:
- below 4%: conservative and safer,
- around 4%: broadly classic and sensible,
- above 4%: higher risk,
- above 5%: increasingly aggressive.

### Monte Carlo success rate
When the stress test is enabled, the tool runs 200 simulated market paths. A higher score means the plan is more robust under uncertainty.

---

## Assumptions and notes

The calculator is a planning model, not a guaranteed prediction.

Important considerations:
- It uses simplified assumptions about returns, inflation, pension access, and spending.
- It is designed for educational and planning purposes.
- It does not account for every tax rule, investment fee, or personal circumstance.
- The app uses “today’s pounds” for most planning values.

The notes section in the app also highlights:
- pension access at age 57 in the UK,
- tax efficiency concerns,
- the fact that mortgage balance becomes less painful in real terms as inflation rises.

---

## Example workflow

1. Enter your current age and starting balances.
2. Add your mortgage details.
3. Enter your monthly income and expenses.
4. Set your monthly ISA and pension contributions.
5. Choose your target post-FIRE income.
6. Adjust return and inflation assumptions.
7. Enable the stress test to see how resilient the plan is.
8. Review the chart, table, and insights to compare scenarios.

---

## Troubleshooting

### The page does not load properly
- Make sure you are opening it in a modern browser.
- If you are using a local server, confirm the file path is correct.
- If the app cannot load fonts or scripts, check your internet connection because it uses CDN resources.

### The results look unrealistic
- Try adjusting the return and inflation assumptions.
- Increase the over-funding buffer if you want a more conservative retirement target.
- Reduce your target spending or increase your monthly savings.

### The plan says it is not viable
That usually means the assumptions you entered are too aggressive for the current savings and spending pattern. Consider:
- saving more,
- retiring later,
- reducing your target income,
- improving expected returns,
- lowering inflation assumptions.

---

## License

This project is a personal planning tool and is intended for educational use. Feel free to adapt it for your own use.

---

## Summary

This simulator is best used as a decision-support tool for exploring how your financial plan might evolve over time. It helps you ask better questions about retirement timing, mortgage strategy, and the trade-off between spending, saving, and risk.