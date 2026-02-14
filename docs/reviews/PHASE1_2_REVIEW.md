# Phase 1.2 Code Review — Stripe Payments & AI Chatbot

**Date:** 2026-02-14  
**Reviewer:** Gemini (subagent)  
**Status:** ⚠️ Mostly Good — Several Issues to Address

---

## Executive Summary

Both features are well-structured and functional. The Stripe integration follows best practices for webhook verification and has proper chitanță generation. The chatbot has a solid keyword-matching fallback with graceful LM Studio degradation. However, there are **security concerns**, **race conditions**, and **missing edge cases** that should be fixed before production.

---

## 1. Stripe Payment Integration

### ✅ What's Good

- **Webhook signature verification** — properly uses `constructEvent()` in both `webhook/route.ts` and `stripe-provider.ts`
- **Idempotency** — webhook handler checks `if (onlinePayment.status === "confirmed")` to skip duplicates
- **Chitanță generation** — full flow: creates `Plata`, `PlataDistributie`, updates `Impozit` balances, and generates a `Document` record
- **Gateway abstraction** — clean `GatewayProvider` interface; `PAYMENT_MODE=stripe` env toggle is elegant
- **Payment expiry** — 30-minute Stripe session + `expiresAt` stored in DB
- **Bank transfer flow** — nice UX with copy-to-clipboard for IBAN/reference details
- **Input validation** — checks auth, contribuabil access, required fields

### 🔴 Critical Issues

#### 1.1 Race Condition in Webhook — Chitanță Number Generation
```typescript
// webhook/route.ts
const paymentCount = await prisma.plata.count({ where: { tenantId } });
const nrChitanta = generateDocumentNumber("CHT", year, paymentCount + 1);
```
**Problem:** Two concurrent webhooks can get the same count → duplicate chitanță numbers.  
**Fix:** Use a DB sequence or `findMany` + unique constraint with retry logic.

#### 1.2 No Transaction Wrapping in Webhook
The webhook handler does multiple DB writes (create Plata, update OnlinePayment, create PlataDistributie × N, update Impozit × N, create Document) without a `prisma.$transaction()`. A failure midway leaves data in an inconsistent state.  
**Fix:** Wrap the entire block in `prisma.$transaction()`.

#### 1.3 Webhook Only Handles `checkout.session.completed`
Missing handlers for:
- `checkout.session.expired` — should mark OnlinePayment as "expired"
- `payment_intent.payment_failed` — should mark as "failed"
- `charge.refunded` — needed for refund support

Currently, expired/failed sessions silently stay as "initiated" forever.

### 🟡 Medium Issues

#### 1.4 `create-checkout/route.ts` Still Imports from `ghiseul-mock`
```typescript
import { getPaymentGateway } from "@/lib/payments/ghiseul-mock";
```
This works (the function checks `PAYMENT_MODE`) but the import path is misleading. Should export from `gateway.ts` or a dedicated `index.ts`.

#### 1.5 No Amount Validation
The `items` array from the request body is passed through without validating that `amount` values are positive numbers matching actual debt amounts. A malicious client could submit `amount: 0.01` for a 500 RON debt.  
**Fix:** Server-side lookup of actual `impozit.sumaDatorata - sumaPlatita` to verify amounts.

#### 1.6 `success_url` Template Variable
```typescript
success_url: `${params.returnUrl}?ref={CHECKOUT_SESSION_ID}&status=success`,
```
Should be `{CHECKOUT_SESSION_ID}` (Stripe template syntax). Verify this works — Stripe uses `{CHECKOUT_SESSION_ID}` not `${...}`.  
✅ This is correct — it's a Stripe template literal, not JS interpolation.

#### 1.7 Bank Transfer Has No Reconciliation Path
The `bank-transfer/route.ts` creates a pending OnlinePayment but there's no visible endpoint or admin flow to confirm when the bank transfer actually arrives. This needs a manual confirmation route or automated bank statement import.

#### 1.8 Stripe Proxy Object
```typescript
export const stripe = new Proxy({} as Stripe, { ... });
```
Clever but fragile — no `has`, `set`, or `apply` traps. If any code does `instanceof`, `in`, or tries to call `stripe()`, it'll break silently. The `getStripeClient()` function is safer; consider deprecating the proxy export.

### 🟢 Minor Issues

- `stripe.ts` uses API version `"2026-01-28.clover"` — verify this is the correct/latest
- Error messages returned to client are generic (good for security)
- `formatLei` in the page component is clean

---

## 2. AI Chatbot Widget

### ✅ What's Good

- **Graceful degradation** — if LM Studio is down or `LM_STUDIO_URL` unset, falls back to keyword matching. This is excellent.
- **Text normalization** — strips diacritics, lowercases, cleans punctuation for fuzzy Romanian matching
- **Knowledge base** — comprehensive 28 entries covering taxes, payments, documents, deadlines, exemptions
- **UX** — smooth open/close animation, loading spinner, Enter-to-send, auto-scroll
- **All user-facing strings in Romanian** ✅
- **No exposed secrets** — chatbot API is stateless, no auth needed (public FAQ)

### 🟡 Medium Issues

#### 2.1 No Rate Limiting on `/api/chatbot`
The endpoint is unauthenticated and hits LM Studio on every request. Easy to abuse.  
**Fix:** Add rate limiting (e.g., IP-based, 10 req/min).

#### 2.2 No Input Length Limit
```typescript
const message = typeof body?.message === "string" ? body.message.trim() : "";
```
A user could send a 1MB string that gets normalized and compared against all keywords, then forwarded to LM Studio.  
**Fix:** `message.slice(0, 500)` or similar.

#### 2.3 LM Studio Request Has No Timeout
```typescript
const response = await fetch(getLmStudioEndpoint(lmStudioUrl), { ... });
```
If LM Studio hangs, the request hangs indefinitely (until Next.js default timeout).  
**Fix:** Add `signal: AbortSignal.timeout(10000)`.

#### 2.4 Hardcoded `"local-model"` in LM Studio Payload
```typescript
model: "local-model",
```
Should be configurable via env var (e.g., `LM_STUDIO_MODEL`) since model names vary.

#### 2.5 No Conversation History
Each message is stateless — no context from previous messages. The LM Studio call gets only the current question + knowledge snippets. This is fine for FAQ but means follow-up questions like "Și pentru teren?" after asking about clădiri won't work.  
**Recommendation:** Low priority, but consider sending last 3-5 messages for context.

### 🟢 Minor Issues

- Widget hardcodes "Se proceseaza..." instead of using `useTranslations` — minor inconsistency
- The `"Powered by PrimarIA AI"` footer is a nice touch
- No XSS risk since React auto-escapes content

---

## 3. Romanian Language Check

| Area | Status | Notes |
|------|--------|-------|
| Chatbot knowledge base | ✅ | All 28 entries in Romanian |
| Chatbot widget UI | ✅ | Welcome message, placeholder, error messages in Romanian |
| Chatbot loading text | ⚠️ | "Se proceseaza..." hardcoded, not in translation files |
| Payment page | ✅ | Uses `useTranslations("portal")` throughout |
| API error messages | ✅ | Generic English (internal), user never sees them |
| Bank transfer details | ✅ | Labels use translation keys |

---

## 4. Summary of Action Items

### Must Fix (Before Production)
| # | Issue | File | Effort |
|---|-------|------|--------|
| 1 | Wrap webhook in `$transaction()` | `webhook/route.ts` | 30min |
| 2 | Fix chitanță number race condition | `webhook/route.ts` | 1h |
| 3 | Server-side amount validation | `create-checkout/route.ts` | 1h |
| 4 | Add rate limiting to chatbot | `api/chatbot/route.ts` | 30min |
| 5 | Add input length limit to chatbot | `api/chatbot/route.ts` | 5min |

### Should Fix (Before Beta)
| # | Issue | File | Effort |
|---|-------|------|--------|
| 6 | Handle `checkout.session.expired` webhook event | `webhook/route.ts` | 1h |
| 7 | Add timeout to LM Studio fetch | `api/chatbot/route.ts` | 5min |
| 8 | Move `getPaymentGateway` to proper export | `ghiseul-mock.ts` → `gateway.ts` | 15min |
| 9 | Make LM Studio model name configurable | `api/chatbot/route.ts` | 5min |
| 10 | Bank transfer reconciliation flow | New endpoint | 4h |

### Nice to Have
| # | Issue | Effort |
|---|-------|--------|
| 11 | Chatbot conversation history (last 3-5 msgs) | 2h |
| 12 | Deprecate Stripe proxy export | 15min |
| 13 | Move hardcoded "Se proceseaza..." to translations | 5min |

---

## 5. Overall Assessment

**Stripe Integration: 7.5/10** — Solid foundation with proper webhook verification and chitanță generation. The race condition and missing transaction wrapper are the main concerns. Amount validation is a security gap.

**Chatbot Widget: 8/10** — Clean architecture with excellent graceful degradation. The keyword-based fallback means the chatbot works even without LM Studio. Main gaps are rate limiting and input validation.

**Architecture: 8.5/10** — The `GatewayProvider` abstraction is well-designed. The `PAYMENT_MODE` env toggle makes it easy to switch between mock and Stripe. Knowledge base is cleanly separated from the API route.

**Ready for production?** Not yet — fix items 1-5 first. Could go to beta after items 1-3.
