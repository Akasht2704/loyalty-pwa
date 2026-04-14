This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API: `POST /api/qrscan`

Scans a QR code against `coupons`, optionally updates user role/brand context for authenticated users, and writes a scan audit row to `scan_log`.

### Authentication

- Optional bearer token (`Authorization: Bearer <jwt>`).
- If token is valid, API:
  - writes `scan_log` entry
  - may return `newToken` + updated `user` after brand-role resolution
- If token is missing/invalid, coupon lookup still works, but no authenticated side-effects happen.

### Request Body

```json
{
  "qrcode": "QR_PAYLOAD_TEXT",
  "scan_data": { "qr_code": "QR_PAYLOAD_TEXT" },
  "latitude": 28.6139,
  "longitude": 77.2090,
  "scanState": "Delhi",
  "scanDistrict": "New Delhi",
  "scanCity": "New Delhi"
}
```

- `qrcode` (required, `string`): scanned QR payload.
- `scan_data` (optional, `object`): currently only `{ qr_code: string }` is persisted.
  - If missing/invalid, backend falls back to `{ qr_code: qrcode }`.
- `latitude`, `longitude` (optional, `number`): used for logging and reverse geocoding.
- `scanState`, `scanDistrict`, `scanCity` (optional, `string`): explicit location labels.
  - If any are missing and coordinates are present, backend attempts reverse geocoding via Nominatim.

### Success Responses

#### 1) Coupon found

```json
{
  "success": true,
  "data": [
    {
      "qr_code": "QR_PAYLOAD_TEXT",
      "product_name": "Example Product",
      "brand_id": 2
    }
  ],
  "newToken": "<optional-jwt>",
  "user": {
    "userId": 12,
    "name": "John",
    "phone": "9999999999",
    "appId": 1,
    "roleId": 4,
    "brandId": 2
  }
}
```

- `newToken` and `user` appear only when authenticated flow updates/resolves role+brand context.

#### 2) Coupon not found

```json
{
  "success": false,
  "error": "Coupon not found",
  "data": []
}
```

> For authenticated users, a `scan_log` row is still attempted even when coupon is not found.

### Error Responses

- `400`:

```json
{ "error": "QR code is required" }
```

- `500`:

```json
{ "error": "<server error message>" }
```

### Side Effects (Authenticated Requests)

1. **Scan audit log** (`scan_log`):
   - stores user/app context, QR payload, location, optional coupon-linked fields, and `scan_data`.
2. **Role/brand update logic** when coupon has `brand_id`:
   - finds default role for that brand
   - updates existing `user_roles` row with `brand_id IS NULL`
   - otherwise inserts a new row only if same `(user_id, app_id, role_id, brand_id)` does not already exist
3. **Token refresh**:
   - returns `newToken` with updated `roleId`/`brandId` when role context changes.

### Notes for Mobile Clients

- Send the same JSON format as web.
- Always include `Authorization: Bearer <jwt>` after login to enable:
  - scan logging with user context
  - role/brand updates
  - token refresh via `newToken`.
