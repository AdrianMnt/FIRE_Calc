# FIRE Calculator

Compare full retirement, Coast FIRE and part-time FIRE using monthly cash flows in today's pounds. Open `index.html` directly in a current browser or serve the directory as a static site. The app runs locally in the browser and saves inputs in browser storage. Fresh installs use a fictional UK example with round figures, and **Load example** restores those figures after confirmation. Existing inputs are stored locally and carry forward. The former **tax drag** setting is retired because it represented both a spending uplift and a withdrawal tax. Include UK healthcare and other spending in annual retirement spending. Romania has a separate healthcare input.

## Reading the results

- **Full FIRE** finds the earliest month when your cash, accessible investments, Lifetime ISA from age 60, unlocked pension and State Pension can cover spending and mortgage payments to the end of the planning horizon.
- **Coast FIRE** finds when you can stop contributing and overpaying the mortgage, while take-home income still covers working expenses and regular mortgage payments. You can enter a separate Coast take-home amount to evaluate a lower-paying job. The accumulated portfolio grows until the retirement age you choose.
- **Barista FIRE (part-time)** finds when you can leave full-time work and use part-time pay plus the portfolio. Pay stops on the age boundary you specify. Use gross taxable pay to calculate how the job affects tax on pension income, and net pay for cash flow.
- **Investable assets** include cash, investments, LISA and private pensions. **Accessible assets** exclude pensions and include the LISA from age 60. **Net worth** adds home equity and other assets, less other debts. Put other debt service into your spending inputs.
- **Milestones** show balances already reached and the first projected crossing for accessible assets, pension and net worth. Progress bars show the current balance against the next target. Select a projected milestone age to inspect that month on the chart. The default targets include £100,000. Set your own positive amounts under **Milestone targets**.

Results depend on the end age. The horizon is the age up to which the calculator funds spending. You can require a minimum period in full retirement before that age. Every month through that boundary must be funded and any mortgage must be paid off. Each plan uses the same cash-flow code for eligibility, projection and stress testing. The optional spending buffer applies during the eligibility check. A plan can pass the deterministic check and still fail in some simulated market paths.

Select any headline figure for its calculation and the assumptions behind it. The chart offers separate balances, mortgage and stress-test views. Hover, tap or use the keyboard to inspect a month. The mortgage payoff is marked directly on the chart.

Coast and Barista each have an optional mortgage-free requirement. When selected, the model keeps the full-time budget and any mortgage overpayments until payoff, then searches for an eligible start. Both options default to off.

Enable **Show target ages** and choose a percentage to find the first month each plan reaches that target. Every start uses the same 500 seeded market paths, the stated spending and the matching mortgage-free switch. A missing age means no eligible start reached the threshold. Click **View projection** to inspect the chart, mortgage date, table and milestones at that start. **Show baseline** returns to the steady-return start. Each result is also checked on 500 fresh paths, which may produce a higher or lower percentage. The target is a result under the entered assumptions and changes with market return, spending and the horizon.

## Compare a decision at fixed ages

Use **Compare your next move** to enter a UK part-time start age, a Romania move and retirement age, and two purchase prices. Blank ages use the current age and the relocation age from settings where valid. Both price cases use the same household inputs and fees, so adjust the fees when comparing purchases with materially different costs. The cards can run even when relocation is switched off for the main projection. They use your selected return and spending buffer, identify the first unfunded month, and distinguish purchase affordability from covering expenses after the move.

The monthly budget through pension access is the highest whole-pound monthly amount the assets can cover in the steady-return simulation before private pension access or the planning horizon, whichever comes first. It includes healthcare, uses the spending buffer and can leave the accessible balance exhausted at the boundary. Optionally stress-test the same dates with 500 seeded monthly return paths.

Use separate UK part-time spending and workplace pension credits if your reduced-hours budget differs from the retired budget. Take-home pay is after payroll deductions. The model uses the household’s total take-home in that phase and ends all employment income on the specified date.

Annual percentage mortgage overpayments apply after that month’s normal payment and cash saving, and then repeat every 12 months while working in the UK. The percentage is applied to the mortgage balance after the regular payment. Payments use cash available and stop at the lender limit entered, with the rest reported as unfunded. This is an approximation of a lender’s terms. Check its balance reference date, simultaneous monthly overpayments, fixed-rate expiry and early repayment costs.

## Compare staying in the UK with relocating

Enable **Romania relocation**, enter the move age and open **Location, returns and pension sensitivity**. It compares earliest Full, Coast and Barista starts under the entered return and 3%, 4% and 6% annual real investment returns. The table also tests zero State Pension when you have entered a forecast, a higher effective private pension tax, and removing any UK mortgage overpayment. Working pay left over after the stated budget and savings is excluded from the portfolio. To compare redirecting an overpayment into investments or cash savings, enter that amount as an explicit contribution.

The final column checks stopping work at the move age in both locations, after continuing the configured full-time budget up to that age. For the move it shows forecast UK equity, cash transaction costs, the amount released or needed from savings, and the first shortfall if there is one. Compare two purchase prices by changing the Romanian home price. Test local household spending, healthcare, pay, sale fees, legal fees, mortgage exit fees, currency conversion and setup costs using separate fields.

The UK sale and Romanian purchase settle together at the start of the move month. The existing mortgage is repaid from the sale. An affordable shortfall comes from cash and accessible investments, including LISA if age 60 or older. The model excludes funding the purchase via private pension or a new mortgage. A Coast plan can use savings for this one-time transaction. Ordinary Coast spending still has to come from take-home pay. Property values are held flat in real sterling unless you override the UK sale value at the move. An override recognises the resulting change in equity at the sale. New Romanian savings go into an accessible investment account outside the UK ISA. Extra taxes on investment returns should be built into the entered return or fees.

## Model conventions

- Each month starts at the displayed age. Cash flows come first and growth follows. Decimal ages round to the nearest month. Contributions and living expenses are in today's pounds. Mortgage payments and interest run on a nominal schedule. A specified mortgage term makes any outstanding balance payable in the final month of that term.
- Working net pay is after payroll contributions. Enter the gross workplace pension credit separately. Personal SIPP contributions use take-home cash and the selected gross-up factor. The app flags an unfunded working budget and stops projecting it. Investing freed mortgage payments is optional and limited to funded surplus.
- Retirement spends cash, new accessible investments outside the UK ISA, opening ISA and other accessible investments, LISA from age 60, then accessible pension. Early LISA withdrawals and LISA contributions and bonuses are excluded. Excess part-time or State Pension income accumulates as cash. Cash earns the fixed nominal after-tax interest you enter, defaulting to zero. ISA and pensions use the same return assumption, net of fees and inflation.
- Private pension access and State Pension start ages are inputs. The default of 57 assumes the post-April 2028 normal minimum. Verify the scheme date and enter any applicable exception. State Pension defaults to zero for fresh inputs. Enter your personal forecast. The separate gross State Pension input applies in part-time and retirement phases. Include any State Pension already received during full-time work or coasting in working take-home pay.
- Income tax uses annualised 2026/27 non-savings bands for the selected UK region, including the personal allowance taper. Thresholds are held flat in today's pounds. The model applies marginal tax to State Pension and taxable private withdrawals after existing taxable pay. It does not calculate tax-year transitions, PAYE timing, future policy changes, National Insurance or individual reliefs. Supply net part-time pay after deductions. The optional UK household estimate applies the tax calculation twice to an equal split of gross State Pension, private withdrawals and existing taxable pay. It assumes a common age timeline and shared access dates. Enter the combined remaining lump sum allowance for that approximation. The model does not track each spouse’s taxable pay, pot, allowance or start age separately.
- The pension starts as an uncrystallised defined-contribution pot. Draws from that pot are up to 25% tax-free, limited by the remaining **nominal** lump sum allowance. An optional one-off amount transfers cash and crystallises the corresponding taxable portion. The model withdraws from crystallised funds first. The calculator flags ISA deposits above the 2026/27 allowance in a rolling 12-month period in today's pounds. The flag includes mortgage-payment redirection. The UK ISA deposit flag uses one allowance. Actual per-person tax-year limits, pension contribution limits, MPAA and defined-benefit pensions are outside the model. The Romania path uses editable effective rates on gross State Pension and gross private pension withdrawals, without a UK tax-free withdrawal in that phase. These rates are illustrative, and the model excludes tax treaty residency rules, foreign pension scheme rules, FX volatility and local investment reporting.
- The stress test uses 500 seeded paths at the same chosen start date. All invested pots share the same monthly shock. The model also tests whether volatile balances can fund the relocation purchase. The lognormal model uses the entered return as its arithmetic expectation and the entered volatility as the annualised log-return standard deviation. The band shows the 10th–90th percentiles of assets among funded paths. The breakdown classifies the first failure per path and shows the median failure age. The second set of paths uses a different seed and the same return assumptions. It is a sensitivity test under these assumptions.

Official references

- [Lifetime ISA withdrawal rules](https://www.gov.uk/lifetime-isa/withdrawing-money-from-your-lifetime-isa)
- [UK ISA rules when moving abroad](https://www.gov.uk/individual-savings-accounts/if-you-move-abroad)
- [ISA rules and allowance](https://www.gov.uk/individual-savings-accounts/how-isas-work)
- [State Pension forecast](https://www.gov.uk/check-state-pension)
- [Private pension minimum age](https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual/ptm028000)
- [Pension lump sums and the standard allowance](https://www.gov.uk/tax-on-pension/tax-free)
- [England, Wales and Northern Ireland income tax](https://www.gov.uk/income-tax-rates) and [Scottish income tax](https://www.gov.uk/scottish-income-tax)

## Audit fixes

| Previous behaviour | Corrected behaviour |
| --- | --- |
| The viability, displayed projection and Monte Carlo paths used different tax and withdrawal logic. | All three use one monthly engine and tax model. |
| The first retirement check skipped today, and the transition month could include both working overpayment and retirement drawdown. | Candidate dates include today. The selected phase governs all transactions from its first month. |
| The stress test reset negative ISA balances to zero, letting unfunded months survive until pension access. | The first unfunded month ends the path and the path counts as failed. |
| Lump sums reduced pension value without crediting cash. The age-55 window could fire twice and differed from age-57 access. | A single, capped transfer preserves value and uses the same access rule as withdrawals. |
| The spending uplift could double as a pension tax, and State Pension was treated as net income and could not cover mortgage costs. | Spending is entered separately. Both pensions are taxed as appropriate and their net proceeds can cover all expenses. |
| Work contributions and automatic redirection could exceed available cash or appear on an already mortgage-free plan. | The working budget funds all stated costs before contributions. Redirection is optional and only releases actual capacity. |
| Some results labelled a deterministic path as 100% safe and compared a spending target to a generic 4% rule. | Report simulation counts only after running a stress test. Eligibility follows the projected cash flows and horizon. |

## Development

Run `node --test` with Node.js 18 or later. `fire-model.js` contains the shared monthly engine. `uk-tax.js` contains UK tax policy. `app.js` handles form inputs, saved settings and rendering. `fire-model.test.js` includes independently calculated fixtures for tax, mortgage amortisation, cash flows and access boundaries.
