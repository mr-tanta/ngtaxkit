import { createRequire } from 'node:module';

const requireFromCwd = createRequire(`${process.cwd()}/package.json`);
const { InvalidDateError, pension, rates, tools, vat, wht } = requireFromCwd('ngtaxkit');
const browser = requireFromCwd('ngtaxkit/browser');

const vatTrace = vat.explainCalculate({ amount: 100_000, category: 'standard' });
const toolTrace = tools.callTool('ngtaxkit.vat.explain_calculate', {
  amount: 100_000,
  category: 'standard',
});
const source = rates.explain('vat.standard.rate');
const audit = rates.audit();

if (vatTrace.result.vat !== 7_500) {
  throw new Error(`Expected VAT 7500, got ${vatTrace.result.vat}`);
}
if (toolTrace.result.vat !== 7_500) {
  throw new Error(`Expected tool VAT 7500, got ${toolTrace.result.vat}`);
}
if (source.sourceTitle !== 'Nigeria Tax Act, 2025') {
  throw new Error(`Unexpected VAT source title: ${source.sourceTitle}`);
}
if (audit.totalKeys <= 0) {
  throw new Error('Expected rate audit to report bundled rate keys');
}
if (typeof browser.toPDF !== 'undefined') {
  throw new Error('Expected browser entrypoint to exclude Node-only PDF exports');
}
if (typeof browser.vat?.calculate !== 'function') {
  throw new Error('Expected browser entrypoint to expose VAT calculator');
}

for (const [description, callback] of [
  ['VAT invalid date', () => vat.calculate({ amount: 100, date: 'bad-date' })],
  [
    'WHT invalid payment date',
    () => wht.calculate({
      amount: 100,
      payeeType: 'individual',
      serviceType: 'professional',
      paymentDate: 'bad-date',
    }),
  ],
  [
    'Pension invalid salary payment date',
    () => pension.calculate({ basicSalary: 100, salaryPaymentDate: 'bad-date' }),
  ],
]) {
  try {
    callback();
  } catch (error) {
    if (error instanceof InvalidDateError) continue;
    throw error;
  }

  throw new Error(`Expected InvalidDateError for ${description}`);
}

console.log(JSON.stringify({
  vat: vatTrace.result.vat,
  toolVat: toolTrace.result.vat,
  source: source.sourceTitle,
  totalKeys: audit.totalKeys,
  browserVat: typeof browser.vat.calculate,
}));
