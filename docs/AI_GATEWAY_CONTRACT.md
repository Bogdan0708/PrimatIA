# AI Gateway Contract

This repo now treats the AI gateway as an OpenAI-compatible upstream with explicit provider selection.

## Required Env Shape

- `AI_GATEWAY_URL`
- `AI_GATEWAY_KEY`
- `AI_GATEWAY_PROVIDER`
- `AI_GATEWAY_MODEL`

Example:

```env
AI_GATEWAY_URL=https://your-ai-gateway-url
AI_GATEWAY_KEY=CHANGE_ME
AI_GATEWAY_PROVIDER=gemini
AI_GATEWAY_MODEL=gemini-2.0-flash
TENANT_ID=<municipality-tenant-uuid>
```

## Request Contract

Chatbot and OCR calls send:

- OpenAI-compatible `POST /v1/chat/completions`
- `Authorization: Bearer <AI_GATEWAY_KEY>`
- `provider` in the JSON body when gateway routing is needed
- `x-tenant-id` header when `TENANT_ID` is configured

## Privacy Guardrail

Before prompts leave this repo, the client layer redacts common identifiers:

- CNP
- email
- phone
- IBAN
- VIN
- explicit `NUME` / `PRENUME` field values

This scrubbing is implemented in `src/lib/ai/pii-scrubber.ts` and applied by:

- `src/lib/ai/knowledge-base.ts`
- `src/lib/ocr/document-processor.ts`

## Backward Compatibility

If `AI_GATEWAY_MODEL` still contains a provider alias like `gemini`, this repo temporarily interprets it as:

- `AI_GATEWAY_PROVIDER=gemini`
- `AI_GATEWAY_MODEL=gemini-2.0-flash`

That compatibility shim should be treated as temporary cleanup support, not the target configuration.
