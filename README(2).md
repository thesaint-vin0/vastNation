# Vast Nation

A modern full-stack fashion e-commerce platform for Vast Nation, built around React, Supabase, Supabase Storage, Supabase Realtime, Supabase Edge Functions, and Paystack.

**Repository:** https://github.com/thesaint-vin0/vastNation  
**Currency:** NGN (₦)  
**Primary market:** Nigeria

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [Authentication](#authentication)
- [Products and Image Uploads](#products-and-image-uploads)
- [Cart and Checkout](#cart-and-checkout)
- [Delivery Fee](#delivery-fee)
- [Paystack Integration](#paystack-integration)
- [Payment Verification and Webhooks](#payment-verification-and-webhooks)
- [Orders](#orders)
- [Admin Dashboard](#admin-dashboard)
- [Realtime Updates](#realtime-updates)
- [Customers](#customers)
- [Reviews](#reviews)
- [Coupons and Discounts](#coupons-and-discounts)
- [Security and RLS](#security-and-rls)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Testing Checklist](#testing-checklist)
- [Troubleshooting](#troubleshooting)
- [Production Recommendations](#production-recommendations)
- [Git and GitHub](#git-and-github)
- [License](#license)

---

## Overview

Vast Nation is a premium fashion e-commerce website with a customer storefront and an administrative management system.

The storefront supports product discovery, product variants, cart management, customer authentication, checkout, delivery pricing, coupons, reviews, and Paystack payments.

The administration system is designed to manage products, product images, orders, customers, reviews, coupons, and store settings such as delivery fees.

The backend uses Supabase for authentication, PostgreSQL data, file storage, realtime database events, and server-side Edge Functions.

The payment architecture intentionally creates orders as `pending`, initializes Paystack through a server-side Edge Function, and relies on server-side payment verification/webhooks before an order is considered paid.

---

## Features

### Customer

- Responsive fashion storefront
- Product catalogue
- Product detail pages
- Product images
- Size and color variants
- Shopping cart
- Quantity management
- Customer registration and login
- Checkout
- Shipping address collection
- Delivery fee calculation
- Free-delivery threshold
- Coupon/discount support
- Paystack checkout
- Order history
- Product reviews
- Animated UI interactions

### Admin

- Admin authentication
- Product creation/editing/deletion
- Product image upload
- Inventory management
- Category management
- Order management
- Customer management
- Review management
- Coupon management
- Store settings
- Editable delivery fee
- Free-delivery threshold
- Payment/order monitoring
- Realtime updates

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- Framer Motion
- Lucide React
- Tailwind CSS/project utility classes
- React Context for shared state

### Backend

- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions

### Payments

- Paystack
- Transaction initialization
- Payment authorization
- Webhook/payment verification

### Tooling

- Node.js
- npm
- Git
- GitHub
- Vercel or another static/frontend host

---

## Architecture

```text
                         VAST NATION
                              |
             +----------------+----------------+
             |                                 |
             v                                 v
       Customer Store                     Admin Portal
             |                                 |
       +-----+-----+                    +------+------+
       |           |                    |             |
    Products      Cart              Products       Orders
       |           |                 Customers      Reviews
       |           |                 Settings       Coupons
       +-----+-----+                    |
             |                          |
             v                          v
          Checkout <-------------- Supabase
             |
       +-----+------+
       |            |
    Delivery      Discount
       |            |
       +-----+------+
             |
             v
          Total
             |
             v
      Pending Order
             |
             v
    Supabase Edge Function
             |
             v
          Paystack
             |
             v
       Customer pays
             |
             v
     Paystack Webhook
             |
             v
   Server-side verification
             |
             v
      Supabase Orders
             |
             v
     Supabase Realtime
             |
             v
       Admin Dashboard
```

---

## Project Structure

The exact structure can change as the project evolves, but the application is organized around these responsibilities:

```text
vastNation/
├── public/
│   └── images/
│
├── src/
│   ├── components/
│   ├── context/
│   │   ├── AuthContext.*
│   │   ├── CartContext.*
│   │   └── ToastContext.*
│   ├── hooks/
│   ├── pages/
│   │   ├── Checkout.*
│   │   └── Admin.*
│   ├── services/
│   │   ├── api.*
│   │   ├── paystack.*
│   │   ├── storage.*
│   │   └── storeSettings.*
│   ├── utils/
│   ├── types/
│   ├── lib/
│   │   └── supabase.*
│   ├── App.*
│   └── main.*
│
├── supabase/
│   ├── functions/
│   │   ├── paystack-initialize/
│   │   └── paystack-webhook/
│   └── migrations/
│
├── .env
├── .env.example
├── package.json
├── vite.config.*
└── README.md
```

---

## Requirements

Install:

- Node.js LTS
- npm
- Git
- A Supabase project
- A Paystack account

Verify:

```bash
node --version
npm --version
git --version
```

---

## Installation

### 1. Clone

```bash
git clone https://github.com/thesaint-vin0/vastNation.git
cd vastNation
```

### 2. Install

```bash
npm install
```

### 3. Configure environment variables

Create `.env` and add the variables described below.

### 4. Run locally

```bash
npm run dev
```

If you are unsure which scripts are available:

```bash
npm run
```

---

## Environment Variables

Frontend variables:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLIC_KEY
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxx
```

Production:

```env
VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxx
```

Server-side Supabase Edge Function secret:

```env
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxx
```

Production:

```env
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxx
```

### Never expose

Never put these in React/Vite source code:

```text
sk_test_...
sk_live_...
SUPABASE_SERVICE_ROLE_KEY
database passwords
webhook secrets
private API credentials
```

Never commit `.env` to GitHub.

---

## Supabase Setup

Create a Supabase project and configure:

1. Authentication
2. PostgreSQL tables
3. Row Level Security
4. Storage
5. Realtime
6. Edge Functions
7. Function secrets

Typical client initialization:

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

---

## Database

The main logical entities are:

```text
profiles
products
categories
orders
order_items
reviews
coupons
store_settings
```

### Products

Recommended fields include:

```text
id
name
slug
description
price
compare_at_price
category_id
images
sizes
colors
stock
badge
is_featured
is_new
is_bestseller
is_trending
is_limited
rating
review_count
created_at
updated_at
```

### Orders

Recommended fields:

```text
id
user_id
order_number
status
subtotal
discount
shipping
total
coupon_code
shipping_address
delivery_method
payment_ref
payment_status
paid_at
paystack_transaction_id
payment_method
created_at
updated_at
```

### Order Items

```text
order_id
product_id
name
image_url
size
color
price
quantity
```

Historical order items should preserve the name, image, price, size, and color at purchase time.

---

## Authentication

Customer authentication is handled by Supabase Auth.

Typical flow:

```text
Register/Login
      |
      v
Supabase Auth
      |
      v
Authenticated Session
      |
      v
Profile
```

Admin authorization should be enforced in the database, not just by hiding UI elements.

A typical profile role is:

```text
role = admin
```

A valid authenticated session has:

```text
role = authenticated
```

---

## Products and Image Uploads

Product images should be uploaded to Supabase Storage rather than saved as local computer paths or relying on external image URLs.

Recommended bucket:

```text
product-images
```

Recommended object structure:

```text
product-images/
└── products/
    └── PRODUCT_ID/
        ├── IMAGE_ID.webp
        ├── IMAGE_ID.webp
        └── IMAGE_ID.webp
```

Example upload:

```ts
const { data, error } = await supabase.storage
  .from('product-images')
  .upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
```

Get the public URL:

```ts
const { data: publicUrl } = supabase.storage
  .from('product-images')
  .getPublicUrl(path);
```

Recommended validation:

```text
image/jpeg
image/png
image/webp
image/gif
```

A reasonable upload limit is 5 MB per image.

Do not store:

```text
C:\Users\Vincent\Pictures\product.jpg
```

in the production database.

---

## Cart and Checkout

Cart items should preserve:

```text
product
quantity
size
color
```

Checkout collects:

```text
Full name
Email
Phone
Address
City
State
Postal code
Country
```

The checkout total is:

```text
Subtotal
- Discount
+ Delivery
= Total
```

The current checkout implementation creates a `pending` order before redirecting to Paystack and does not mark the order paid merely because payment was started.

The existing checkout source also stores the pending order ID, order number, and Paystack reference in:

```text
vastnation_pending_order
```

before redirecting to Paystack.

---

## Delivery Fee

Delivery pricing should be controlled by Admin rather than hard-coded in checkout.

Recommended table:

```text
store_settings
```

Recommended fields:

```text
delivery_fee
free_delivery_enabled
free_delivery_threshold
currency
updated_at
```

Example:

```text
Delivery fee: ₦2,500
Free delivery: Enabled
Free delivery threshold: ₦100,000
Currency: NGN
```

Calculation:

```text
Subtotal = ₦40,000
Delivery = ₦2,500
Total = ₦42,500
```

If:

```text
Subtotal = ₦120,000
```

then delivery can be:

```text
FREE
```

when the free-delivery setting is enabled.

The current source contains a hard-coded fallback of ₦2,500 and free delivery at ₦100,000+, so this logic should be replaced with the database-backed store settings.

Most importantly, the final amount should be validated server-side before Paystack initialization.

---

## Paystack Integration

Vast Nation uses Paystack for payment.

### Public key

Frontend:

```env
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
```

or:

```env
VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
```

### Secret key

Supabase Edge Function:

```env
PAYSTACK_SECRET_KEY=sk_test_xxxxx
```

or:

```env
PAYSTACK_SECRET_KEY=sk_live_xxxxx
```

The secret key must never be placed in the React application.

---

## Payment Flow

The intended payment lifecycle is:

```text
1. Customer validates checkout
        |
2. Generate internal order number
        |
3. Create order with payment_status=pending
        |
4. Call paystack-initialize Edge Function
        |
5. Edge Function validates order amount
        |
6. Paystack transaction is initialized
        |
7. Customer is redirected to Paystack
        |
8. Customer completes payment
        |
9. Paystack sends webhook
        |
10. Webhook signature is verified
        |
11. Transaction/order/reference/amount are validated
        |
12. Order becomes paid
        |
13. Realtime event reaches Admin
```

The current checkout source follows the important pattern of creating the order as pending and calling the payment initialization function without exposing the Paystack secret key to React.

---

## Payment Verification and Webhooks

Never use a browser redirect alone as proof of payment.

The backend/webhook should:

1. Receive the Paystack event.
2. Verify the webhook signature.
3. Identify the order.
4. Verify the payment reference.
5. Verify the amount.
6. Verify the currency.
7. Check that the order has not already been paid.
8. Update the order.
9. Return a successful HTTP response.

Recommended successful state:

```text
payment_status = paid
paid_at = current timestamp
paystack_transaction_id = transaction ID
payment_ref = Paystack reference
```

Webhook processing must be idempotent so repeated webhook deliveries do not create duplicate orders or duplicate fulfillment.

---

## Server-Side Payment Amount

The browser should display the total but should not be trusted as the final payment authority.

Use:

```text
Order ID
   |
   v
Edge Function
   |
   v
Read order from Supabase
   |
   v
Validate subtotal
Validate discount
Validate delivery
Validate total
   |
   v
Initialize Paystack
```

Do not blindly trust a value supplied by:

```js
initializePaystackPayment(email, browserTotal, orderId)
```

A malicious customer could otherwise modify the amount in browser developer tools.

---

## Orders

Keep order status separate from payment status.

### Order status

```text
pending
processing
shipped
delivered
cancelled
```

### Payment status

```text
pending
paid
failed
abandoned
refunded
```

Example:

```text
Order status: processing
Payment status: paid
```

is valid.

---

## Admin Dashboard

Recommended Admin sections:

```text
Dashboard
Products
Orders
Customers
Reviews
Categories
Coupons
Store Settings
Delivery
Payments
```

Admin actions must be protected by authentication and database authorization.

The Admin should be able to edit delivery settings without changing source code or redeploying the website.

---

## Realtime Updates

Orders, customers, and reviews should update in Admin without manually refreshing.

Enable the required tables in Supabase Realtime:

```sql
ALTER PUBLICATION supabase_realtime
ADD TABLE public.orders;

ALTER PUBLICATION supabase_realtime
ADD TABLE public.profiles;

ALTER PUBLICATION supabase_realtime
ADD TABLE public.reviews;
```

If a table is already included, do not add it twice.

Verify:

```sql
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND schemaname = 'public'
AND tablename IN (
  'orders',
  'profiles',
  'reviews'
);
```

Recommended flow:

```text
New order
   |
   v
orders INSERT
   |
   v
Supabase Realtime
   |
   v
Admin subscription
   |
   v
Order appears immediately
```

The same approach applies to customers and reviews.

---

## Customers

Customer records are associated with Supabase Auth users and application profiles.

Admin can display:

- Name
- Email
- Phone
- Registration date
- Order count
- Spending
- Account status

Customer data must be protected with RLS.

---

## Reviews

Recommended review fields:

```text
id
product_id
user_id
rating
comment
status
created_at
updated_at
```

Recommended statuses:

```text
pending
approved
rejected
```

For production, reviews should normally be moderated before appearing publicly.

---

## Coupons and Discounts

Order calculations should follow:

```text
subtotal
-
discount
+
delivery
=
total
```

Coupon validation must happen server-side as well as in the frontend.

Never trust a browser-provided discount amount.

---

## Security and RLS

Enable Row Level Security on sensitive tables.

Example:

```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
```

Customers should only see their own orders:

```sql
CREATE POLICY "Customers can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);
```

Admin policies should be restricted to users whose profile role is `admin`.

Frontend authorization alone is not sufficient.

Do not rely only on:

```ts
if (user.role === 'admin') {
  // allow action
}
```

The database must enforce the same rule.

---

## Local Development

Start:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

List scripts:

```bash
npm run
```

---

## Deployment

### Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Configure frontend environment variables.
4. Deploy.

Frontend environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PAYSTACK_PUBLIC_KEY
```

Do not put:

```text
PAYSTACK_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
```

into the frontend.

### Supabase Edge Functions

Install/login with the Supabase CLI as appropriate.

```bash
supabase login
```

Link:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Set the secret:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxxxx
```

Deploy:

```bash
supabase functions deploy paystack-initialize
supabase functions deploy paystack-webhook
```

For production, use the live secret only in server-side secrets.

---

## Paystack Test Mode

Before live payments, test:

```text
pk_test_...
sk_test_...
```

Verify the entire flow:

```text
Checkout
→ Pending order
→ Paystack initialization
→ Test payment
→ Webhook
→ Server verification
→ Order paid
→ Admin realtime update
```

Do not switch to live mode until the complete flow works.

---

## Paystack Live Mode

Before processing real money:

- Activate the Paystack account.
- Configure the live public key.
- Configure the live secret server-side.
- Configure the webhook.
- Verify HTTPS.
- Test payment verification.
- Test failed payments.
- Test duplicate webhook handling.
- Verify the amount.
- Verify realtime Admin updates.

Use a small real transaction for the first live test.

---

## Testing Checklist

### Authentication

- [ ] Register
- [ ] Login
- [ ] Logout
- [ ] Admin login
- [ ] Unauthorized Admin access blocked

### Products

- [ ] Create product
- [ ] Upload image
- [ ] Upload multiple images
- [ ] Edit product
- [ ] Delete product
- [ ] Update stock
- [ ] Product appears in storefront

### Cart

- [ ] Add product
- [ ] Remove product
- [ ] Change quantity
- [ ] Select size
- [ ] Select color
- [ ] Correct subtotal

### Checkout

- [ ] Customer validation
- [ ] Shipping validation
- [ ] Delivery fee loaded from settings
- [ ] Free-delivery threshold
- [ ] Coupon
- [ ] Correct final total
- [ ] Pending order created

### Paystack

- [ ] Test transaction initializes
- [ ] Redirect works
- [ ] Successful payment verified
- [ ] Webhook received
- [ ] Order becomes paid
- [ ] Failed payment stays unpaid
- [ ] Duplicate webhook is safe
- [ ] Live payment works with a small amount

### Realtime

- [ ] New order appears without refresh
- [ ] Updated order appears without refresh
- [ ] New customer appears without refresh
- [ ] New review appears without refresh
- [ ] Subscription reconnects after temporary network failure

### Security

- [ ] No Paystack secret in frontend
- [ ] No Supabase service role key in frontend
- [ ] RLS enabled
- [ ] Admin authorization enforced by database
- [ ] Customers cannot read other customers' orders
- [ ] Webhook signature validated
- [ ] Payment amount validated server-side

---

## Troubleshooting

### `npm run dev` fails

Make sure you are inside the directory containing `package.json`.

```bash
dir
```

Then:

```bash
npm install
npm run dev
```

### Product creation fails

Product creation has two major operations:

```text
Image upload
+
Database insert
```

If Storage fails, check:

- bucket exists
- bucket name is correct
- authenticated upload policy
- valid session
- image type
- image size

If the database insert fails, check:

- `products` RLS
- admin role
- required columns
- data types
- category ID
- payload

### Realtime does not work

Check the publication:

```sql
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

Also check the browser console and verify that the realtime channel subscribes successfully.

### Payment starts but order stays pending

Check:

1. Paystack transaction
2. Edge Function logs
3. Webhook configuration
4. Webhook signature
5. Payment reference
6. Order ID
7. `orders.payment_status`

### Delivery fee is wrong

Check:

```sql
SELECT *
FROM public.store_settings;
```

Verify:

```text
delivery_fee
free_delivery_enabled
free_delivery_threshold
```

### Supabase session is null

Run:

```ts
const {
  data: { session },
} = await supabase.auth.getSession();

console.log(session);
```

A `null` session means the browser is not authenticated.

---

## Production Recommendations

### Server-side totals

Always validate:

```text
subtotal
discount
delivery
total
```

on the server before Paystack initialization.

### Payment idempotency

Repeated webhooks must not:

- create duplicate orders
- double-mark payments
- duplicate fulfillment

### Inventory reservation

Consider reserving stock during payment and releasing it when a payment fails or expires.

### Order status history

Consider:

```text
order_status_history
```

to record:

```text
pending
processing
shipped
delivered
cancelled
```

### Audit logs

Record important Admin actions:

```text
product created
product edited
product deleted
order status changed
delivery fee changed
review approved
coupon changed
```

### Delivery zones

A future delivery system could support:

```text
Lagos
Abuja
Port Harcourt
Other states
Pickup
```

with different fees.

### Notifications

Consider:

- order confirmation emails
- payment confirmation emails
- shipping notifications
- delivery notifications
- new-order Admin notifications
- new-review Admin notifications

### Image optimization

Resize/compress large images and prefer efficient formats such as WebP/AVIF where appropriate.

---

## Git and GitHub

Check status:

```bash
git status
```

Commit:

```bash
git add .
git commit -m "Update Vast Nation"
```

Push:

```bash
git push origin main
```

If the remote has newer changes:

```bash
git pull --rebase origin main
git push origin main
```

Never commit:

```text
.env
.env.local
Paystack secret keys
Supabase service role keys
database passwords
private credentials
```

Recommended `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.local
.env.*.local
```

---

## License

If Vast Nation is proprietary, do not add an open-source license that grants broad reuse rights.

A simple proprietary notice can be:

```text
Copyright © 2026 Vast Nation.

All rights reserved.

Unauthorized copying, modification, distribution, publication,
commercial use, or reuse of this software or substantial portions
of this software is prohibited without prior written permission
from the copyright holder.
```

Choose the actual legal license appropriate for the project before public distribution.

---

## Final System Flow

### Product

```text
Admin
 ↓
Select image
 ↓
Supabase Storage
 ↓
Image URL
 ↓
Products table
 ↓
Storefront
```

### Customer

```text
Register
 ↓
Supabase Auth
 ↓
Shop
 ↓
Product
 ↓
Cart
 ↓
Checkout
```

### Order

```text
Cart
 ↓
Subtotal
 ↓
Discount
 ↓
Delivery
 ↓
Total
 ↓
Pending Order
```

### Payment

```text
Pending Order
 ↓
Supabase Edge Function
 ↓
Paystack
 ↓
Customer Payment
 ↓
Paystack Webhook
 ↓
Server Verification
 ↓
Paid Order
```

### Admin realtime

```text
Database change
 ↓
Supabase Realtime
 ↓
Admin subscription
 ↓
UI update
```

---

## Project Status

Vast Nation is structured as a production-oriented Nigerian fashion e-commerce platform.

The key systems are:

```text
React
+
Supabase
+
PostgreSQL
+
Supabase Storage
+
Supabase Realtime
+
Supabase Edge Functions
+
Paystack
```

Payment verification, authorization, delivery pricing validation, and other security-sensitive logic should remain on trusted server-side infrastructure.

**Vast Nation — premium fashion commerce powered by React, Supabase, and Paystack.**
