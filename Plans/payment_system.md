# Shield Payment System Architecture

## Overview

A comprehensive payment system enabling venues to pay agencies/security personnel, with wallet functionality and bank payouts.

## Technology Stack

- **Payment Processor**: Stripe Connect
- **Platform Fee**: 7.5-10% (configurable)
- **Supported Methods**: Apple Pay, Google Pay, Cards, UK Bank Transfer
- **Payout Options**: Instant (1% fee) or Standard (2-7 days, free)

---

## Phase 1: Foundation

### 1.1 Database Schema

```sql
-- Connected accounts for agencies and personnel
CREATE TABLE stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('agency', 'personnel')),
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  details_submitted BOOLEAN DEFAULT FALSE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet balances (mirrors Stripe balance)
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  available_balance INTEGER DEFAULT 0, -- in pence
  pending_balance INTEGER DEFAULT 0,   -- in pence
  currency TEXT DEFAULT 'gbp',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- All transactions (payments, payouts, refunds)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_transfer_id TEXT,
  
  -- Parties
  payer_id UUID REFERENCES auth.users(id),      -- venue
  payee_id UUID REFERENCES auth.users(id),      -- agency or personnel
  
  -- Booking reference
  booking_id UUID REFERENCES bookings(id),
  
  -- Amounts (all in pence)
  gross_amount INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  net_amount INTEGER NOT NULL,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'
  )),
  type TEXT NOT NULL CHECK (type IN ('payment', 'payout', 'refund')),
  
  -- Payment method
  payment_method TEXT, -- 'apple_pay', 'google_pay', 'card', 'bank_transfer'
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout requests
CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  stripe_payout_id TEXT,
  
  amount INTEGER NOT NULL,           -- in pence
  currency TEXT DEFAULT 'gbp',
  
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'processing', 'paid', 'failed', 'cancelled'
  )),
  
  payout_type TEXT DEFAULT 'standard', -- 'standard' or 'instant'
  instant_fee INTEGER DEFAULT 0,       -- fee for instant payout
  
  bank_last4 TEXT,
  estimated_arrival TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods saved by venues
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,
  
  type TEXT NOT NULL,        -- 'card', 'bank_account'
  brand TEXT,                -- 'visa', 'mastercard', 'amex'
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  
  is_default BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_payer ON transactions(payer_id);
CREATE INDEX idx_transactions_payee ON transactions(payee_id);
CREATE INDEX idx_transactions_booking ON transactions(booking_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_payout_requests_user ON payout_requests(user_id);
CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
```

### 1.2 Stripe Connect Onboarding Flow

```
User Signs Up
     │
     ▼
┌─────────────────────┐
│  Create Stripe      │
│  Connected Account  │
│  (Express type)     │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Redirect to        │
│  Stripe Onboarding  │
│  (KYC, Bank Details)│
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Webhook: Account   │
│  Updated            │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Ready to Receive   │
│  Payments           │
└─────────────────────┘
```

---

## Phase 2: Payment Flow

### 2.1 Venue Pays for Booking

```
1. Venue confirms booking
2. Show payment sheet (Apple Pay / Card / Bank)
3. Create PaymentIntent with:
   - amount: booking total
   - application_fee_amount: platform fee (7.5-10%)
   - transfer_data.destination: agency/personnel Stripe account
4. Process payment
5. On success:
   - Update booking status
   - Create transaction record
   - Update payee wallet balance
6. Webhook confirms completion
```

### 2.2 Platform Fee Calculation

```javascript
const PLATFORM_FEE_PERCENT = 0.10; // 10%

function calculateFees(bookingAmount) {
  const platformFee = Math.round(bookingAmount * PLATFORM_FEE_PERCENT);
  const netAmount = bookingAmount - platformFee;
  
  return {
    grossAmount: bookingAmount,
    platformFee,
    netAmount,
  };
}

// Example: £100 booking
// Venue pays: £100
// Platform fee: £10
// Agency/Personnel receives: £90
```

---

## Phase 3: Wallet & Payouts

### 3.1 Wallet Dashboard Shows

- **Available Balance**: Money ready to withdraw
- **Pending Balance**: Money from recent payments (typically 7 days)
- **Transaction History**: All incoming payments
- **Payout History**: All withdrawals

### 3.2 Payout Options

| Option | Speed | Cost |
|--------|-------|------|
| Standard | 2-7 business days | Free |
| Instant | Within minutes | 1% of amount |

---

## Phase 4: Web Implementation

### 4.1 API Routes

```
POST   /api/stripe/connect/create-account     # Create connected account
GET    /api/stripe/connect/onboarding-link    # Get onboarding URL
GET    /api/stripe/connect/dashboard-link     # Get Stripe dashboard URL

POST   /api/stripe/payment/create-intent      # Create payment intent
POST   /api/stripe/payment/confirm            # Confirm payment

GET    /api/wallet/balance                    # Get wallet balance
GET    /api/wallet/transactions               # Get transaction history

POST   /api/payouts/request                   # Request payout
GET    /api/payouts/history                   # Get payout history

POST   /api/webhooks/stripe                   # Handle Stripe webhooks
```

### 4.2 Required Pages

**Web App:**
- `/d/agency/payments` - Agency payments dashboard
- `/d/personnel/payments` - Personnel payments dashboard
- `/d/venue/payments` - Venue payment history & methods
- `/d/[role]/payments/setup` - Stripe Connect onboarding

**Mobile App:**
- `/(tabs)/payments` - Payments tab for all roles
- `/payments/setup` - Connect bank account
- `/payments/withdraw` - Request payout
- `/payments/history` - Transaction history

---

## Phase 5: Mobile Implementation

### 5.1 Stripe React Native SDK

```bash
# Install
npm install @stripe/stripe-react-native

# iOS: Add to Podfile
pod 'StripeApplePay'
```

### 5.2 Apple Pay Setup

1. Apple Developer Account → Merchant ID
2. Add Apple Pay capability in Xcode
3. Configure in Stripe Dashboard
4. Use Stripe SDK's Apple Pay sheet

---

## Security Considerations

1. **PCI Compliance**: Stripe handles all card data (we never see it)
2. **Webhooks**: Verify Stripe signatures
3. **Idempotency**: Use idempotency keys for payment creation
4. **Minimum Payout**: Set minimum (e.g., £10) to reduce fraud
5. **Rate Limiting**: Limit payout requests
6. **Fraud Detection**: Stripe Radar included

---

## Environment Variables Required

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Platform Settings
PLATFORM_FEE_PERCENT=0.10
MINIMUM_PAYOUT_AMOUNT=1000  # £10 in pence

# Mobile
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
MERCHANT_IDENTIFIER=merchant.com.shieldapp
```

---

## Implementation Order

### Week 1: Foundation
- [ ] Database migrations
- [ ] Stripe account setup
- [ ] Environment configuration
- [ ] Basic API routes

### Week 2: Onboarding
- [ ] Connected account creation
- [ ] Onboarding flow (web)
- [ ] Onboarding flow (mobile)
- [ ] Webhook handlers

### Week 3: Payments
- [ ] Payment intent creation
- [ ] Apple Pay integration (mobile)
- [ ] Card payment (web & mobile)
- [ ] Transaction recording

### Week 4: Wallet & Payouts
- [ ] Wallet dashboard
- [ ] Transaction history
- [ ] Payout requests
- [ ] Payout webhooks

### Week 5: Testing & Polish
- [ ] Test mode payments
- [ ] Error handling
- [ ] Edge cases
- [ ] UI polish

---

## Cost Breakdown Example

**Scenario**: Venue pays £100 for security

| Item | Amount |
|------|--------|
| Venue pays | £100.00 |
| Stripe fee (1.5% + 20p) | -£1.70 |
| Platform fee (10%) | -£10.00 |
| **Security receives** | **£88.30** |

*Note: Platform fee is taken from gross, Stripe fee is separate*

---

## Future Enhancements

1. **Escrow**: Hold payment until shift completed
2. **Split Payments**: Multiple personnel per booking
3. **Recurring Payments**: For regular bookings
4. **Invoice Generation**: PDF invoices
5. **Tax Reports**: Annual earnings summaries
6. **Multi-currency**: For international expansion
