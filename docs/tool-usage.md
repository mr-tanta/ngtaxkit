# Tool Usage

ngtaxkit can be used as a deterministic calculation tool behind another application. The calling system should not invent rates, legal bases, or deadlines; it should call ngtaxkit and explain the returned object.

## Recommended Pattern

1. Parse the user request into structured inputs.
2. Call the relevant calculator.
3. Prefer `explainCalculate` / `explain_calculate` over `calculate` when the response will be shown to a user.
4. Include `warnings` in the model context.
5. Do not suppress legal/source uncertainty.

## TypeScript Tool Example

```typescript
import { tools } from 'ngtaxkit';

const schemas = tools.getToolSchemas();
const openapi = tools.getOpenApiSpec();

const result = tools.callTool('ngtaxkit.vat.explain_calculate', {
  amount: 100_000,
  category: 'standard',
});
```

## Python Tool Example

```python
from ngtaxkit import tools


schemas = tools.get_tool_schemas()
openapi = tools.get_openapi_spec()

result = tools.call_tool(
    "ngtaxkit.vat.explain_calculate",
    {"amount": 100_000, "category": "standard"},
)
```

## Prompt Guidance

Use language like:

```text
You are using ngtaxkit as the calculation engine. Do not invent Nigerian tax rates.
When ngtaxkit returns warnings, disclose them plainly. Explain calculations from
the formula and source fields. This is developer guidance, not legal advice.
```

## Response Shape

A user-facing answer should include:

- final tax amount
- net/gross/payment amount where relevant
- formula summary
- key source title and legal basis
- warning disclosure if `warnings` is not empty

Avoid returning only prose when a downstream system needs structured output. Store the complete explanation object for audit trails.
