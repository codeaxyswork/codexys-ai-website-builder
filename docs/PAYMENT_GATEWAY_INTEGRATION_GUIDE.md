# Codeaxys AI Website Builder — Payment Gateway Integration & Activation Guide

## 1. Executive Summary & Recommended Primary Gateway

The Codeaxys AI Website Builder integration architecture is now fully prepared for real payment gateway connectivity. 

### Recommendation: **Razorpay as Primary Gateway**
After evaluating Indian domestic customer behavior, international card processing, recurring subscription regulations, INR settlements, and GST compliance, **Razorpay is strongly recommended as the primary payment gateway for Codeaxys**.

| Capability / Factor | Razorpay (Recommended Primary) | Stripe (Secondary / Cross-Border Only) |
| :--- | :--- | :--- |
| **Indian Customer Payment Methods** | **Full Native Support**: UPI (Google Pay, PhonePe, Paytm, BHIM), Netbanking across 50+ banks, RuPay debit/credit cards, domestic Visa/Mastercard. | **Restricted in India**: Credit cards and limited domestic debit cards. No native UPI collection checkout. |
| **Recurring Subscriptions & RBI e-Mandates** | **Full Native Compliance**: Built-in support for **UPI AutoPay** and card e-mandates with automated 24-hour pre-debit notifications and ₹15,000 threshold compliance. | **High Friction**: Stringent RBI tokenization, lack of domestic e-mandate support for most Indian debit cards, strict cross-border export restrictions. |
| **Multi-Month Prepaid Plans (12M / 36M)** | **Seamless**: Standard one-time charge via Razorpay Orders API for ₹2,990 (12M) and ₹6,997 (36M) without recurring mandate hurdles. | Standard charge supported, but customer drop-off on domestic cards is higher. |
| **Domain & Add-on Purchases** | **Single Unified API**: The same merchant account processes software subscriptions, domain registrations (Flow A / ResellerClub), and future add-on packs. | Requires separate PaymentIntents; higher fees for Indian domestic payments. |
| **GST Invoicing & Taxation** | **Built for India**: Native GST fields, customer GSTIN capture for B2B input tax credit, SAC Code 998314 classification, intra-state (CGST+SGST) vs inter-state (IGST) support. | Basic tax calculation; requires third-party tax software or manual GST invoicing. |
| **Domestic Settlement** | T+2 direct settlement into Indian bank accounts without foreign exchange fees. | Subject to export reporting (FIRC/NOC) and mandatory Purpose Code (e.g. P0802). |

---

## 2. Business Verification & KYC Activation Steps (For the Owner)

To activate live payments, the business owner must complete the following onboarding workflow:

### Step 1: Account Registration
1. Navigate to [https://dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup).
2. Enter your business email address and create a strong password.
3. Select your Legal Business Structure:
   - **Private Limited / LLP**
   - **Partnership Firm**
   - **Sole Proprietorship / Individual**

### Step 2: KYC Documentation Required
Prepare and upload the following verified documentation in the Razorpay Dashboard:
- **Business Identity**: Company PAN Card / Proprietor PAN Card.
- **Entity Registration**: Certificate of Incorporation (MCA), Partnership Deed, or Udyam MSME Registration Certificate.
- **GST Compliance**: GSTIN Certificate (mandatory if annual turnover exceeds ₹20 Lakhs, or for B2B tax credits).
- **Bank Account Proof**: Cancelled cheque or recent bank statement (within 3 months) displaying legal account name, account number, and IFSC code matching the registered business entity.
- **Authorized Signatory**: Aadhaar Card (front & back) / Passport / Voter ID, and Board Resolution (for Pvt Ltd/LLP).

### Step 3: Mandatory Website Compliance Audit Checklist
Razorpay compliance auditors inspect the live website before approving Live Mode. The Codeaxys application already satisfies these requirements:
- [x] **Pricing Transparency**: Transparent pricing page (`/pricing`) displaying exact INR amounts (₹299, ₹599, ₹999, ₹1,999) and billing duration details.
- [x] **Terms of Service**: Detailed terms governing software usage, uptime, and trial periods.
- [x] **Privacy Policy**: Data collection disclosure, GDPR/DPDP Act compliance, cookies, and data retention (`/privacy-policy`).
- [x] **Refund & Cancellation Policy**: Transparent statement clarifying that subscriptions can be cancelled anytime (effective at period end) and detailing trial limits.
- [x] **Contact Us Details**: Operational corporate address, support email (`support@codeaxys.com`), and customer contact phone number.

---

## 3. Webhook Setup & Event Configuration

Webhooks ensure that payment completions, recurring renewals, and cancellations are asynchronously synchronized with the Supabase database even if a customer closes their browser during checkout.

### Webhook URL
Configure the following webhook endpoint in your Razorpay Dashboard (**Settings** → **Webhooks** → **Add New Webhook**):
```text
https://<YOUR_PRODUCTION_DOMAIN>/api/billing/webhook
```

### Subscribed Events
Select the following events:
1. `order.paid` — Triggered when an order is successfully paid.
2. `payment.captured` — Triggered when a payment is captured and settled.
3. `payment.failed` — Triggered when customer payment fails or is declined by bank.
4. `subscription.activated` — Triggered when a recurring mandate is registered.
5. `subscription.charged` — Triggered when a recurring billing period renews.
6. `subscription.cancelled` — Triggered when a subscription is cancelled.

### Webhook Secret
- Enter a strong cryptographic string in the **Secret** field in the Razorpay Dashboard.
- Copy this value into your environment as `RAZORPAY_WEBHOOK_SECRET`.
- The Codeaxys server validates incoming payloads using `crypto.timingSafeEqual` with HMAC-SHA256.

---

## 4. Environment Variables Checklist

Placeholders are documented in `.env.example`. When ready to activate sandbox or live mode, configure the following variables in your `.env.local` (local development) and Vercel Project Settings (Staging / Production):

```ini
# ============================================================================
# Payment Gateway Configuration
# ============================================================================
# Provider Selection: "mock" (simulation), "razorpay" (primary), or "stripe" (secondary)
PAYMENT_PROVIDER=razorpay

# Live Activation Guard: Set to "true" ONLY after KYC verification is approved by Razorpay.
# When "false", the system fails closed and prevents real monetary charges.
PAYMENT_LIVE_ENABLED=false

# Allow test simulations in local and staging environments
ALLOW_MOCK_PAYMENTS=true

# Razorpay Credentials (from Razorpay Dashboard -> Settings -> API Keys)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourKeySecretHere

# Razorpay Webhook Secret (from Razorpay Dashboard -> Settings -> Webhooks)
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere

# (Optional) Stripe Secondary Gateway Credentials
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YourStripePublishableKey
STRIPE_SECRET_KEY=sk_test_YourStripeSecretKey
STRIPE_WEBHOOK_SECRET=whsec_YourStripeWebhookSecret
```

---

## 5. Architectural Implementation Overview

### Server-Side Endpoints Implemented

1. **Order Creation (`POST /api/billing/checkout`)**:
   - Calculates server-validated multi-period pricing (`calculatePlanPrice`).
   - Calls `provider.createOrder` to create a gateway Order with amount converted to paise.
   - Logs a `status: 'pending'` record in `billing_transactions`.
   - Returns client order parameters (`orderId`, `keyId`, `amount`, `currency`).

2. **Payment Verification (`POST /api/billing/checkout/verify`)**:
   - Authenticates customer session.
   - Cryptographically verifies the HMAC-SHA256 signature (`order_id|payment_id`).
   - Enforces **Idempotency**: Prevents double-crediting or duplicate activations if called multiple times.
   - Upserts active subscription in `subscriptions` table.
   - Replenishes monthly AI credits to plan allowance without rollover.
   - Generates structured, GST-compliant invoice record (`INV-YYYY-XXXXX`, SAC 998314) stored in transaction metadata.
   - Invalidates user usage cache.

3. **Asynchronous Webhook Processor (`POST /api/billing/webhook`)**:
   - Validates `x-razorpay-signature` or `stripe-signature` from raw request body.
   - Idempotently activates subscriptions upon `order.paid` / `payment.captured`.
   - Records `status: 'failed'` upon payment failures.
   - Updates subscription status upon cancellation events.

---

## 6. Supported Customer Workflows

### FLOW A: Website Creation → Publish with Domain Offer
1. Customer creates AI website.
2. Clicks **Publish Website**.
3. Selects Plan and Billing Duration (12M or 36M).
4. For 36-Month plan: qualifies for **First-Year-Free Custom Domain Offer**.
5. Customer selects domain (e.g. `clientbrand.com`).
6. System calculates plan price + ₹0 year 1 domain offer + transparent subsequent renewal notice + 18% GST.
7. Customer completes checkout via Razorpay.
8. Server verifies signature, activates plan, records domain intent for registration, and updates site status.

### FLOW B: Direct Plan Purchase (Customer-Owned Domain)
1. Customer visits `/pricing` or clicks Upgrade in `/dashboard/billing`.
2. Selects Plan (Starter, Pro, Business, Agency) and duration.
3. Domain purchase is optional (opted-out by default).
4. Checkout processes software subscription only.
5. Customer connects existing owned domain via DNS CNAME/A-record verification in `/dashboard/websites/[id]/domain`.
6. Website is published under customer's verified custom domain.

---

## 7. Safety Invariants & Mode Separation

- **Mock Mode**: Active when `PAYMENT_PROVIDER=mock`. Used for fast automated tests, local development, and staging. Strictly hard-blocked against the production Supabase database target.
- **Sandbox Mode**: Active when `PAYMENT_PROVIDER=razorpay` with `rzp_test_...` keys. Safe for end-to-end checkout testing with test cards and test UPI IDs (`success@razorpay`).
- **Live Mode**: Active ONLY when `PAYMENT_PROVIDER=razorpay`, keys start with `rzp_live_...`, AND `PAYMENT_LIVE_ENABLED=true`. Real monetary transactions are blocked until both conditions are met.
