# Vast Nation Settings + Live Admin Notifications

## What was added
- Functional customer theme preference: light, dark, system.
- Customer notification preferences persisted in `user_settings`.
- Admin Store Settings page at `/admin/settings`.
- Store shipping/tax values loaded by checkout.
- Maintenance mode blocks non-admin storefront access.
- Live admin notification bell.
- Database-generated notifications for new orders, confirmed payments, new reviews and low stock.
- Admin notification switches control whether those events are generated.
- Admin coupon realtime refresh.
- Paystack callback polls and subscribes to order payment status; cart clears only after confirmed `paid` status.

## Apply the database migration

```bash
supabase db push
```

The migration is:
`supabase/migrations/20260827000002_settings_notifications_theme.sql`

## Deploy functions

```bash
supabase functions deploy paystack-initialize
supabase functions deploy paystack-webhook --no-verify-jwt
```

## Verify locally

```bash
npm install
npm run typecheck
npm run build
```

The build environment used to package this archive did not have dependencies installed, so `npm run typecheck` could not be executed to completion here. Run the commands above after extracting the archive.
