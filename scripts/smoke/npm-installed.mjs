import { createRequire } from 'node:module';

const requireFromCwd = createRequire(`${process.cwd()}/package.json`);
const { rates, tools, vat } = requireFromCwd('ngtaxkit');

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

console.log(JSON.stringify({
  vat: vatTrace.result.vat,
  toolVat: toolTrace.result.vat,
  source: source.sourceTitle,
  totalKeys: audit.totalKeys,
}));
