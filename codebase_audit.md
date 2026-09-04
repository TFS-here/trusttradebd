# TrustTrade BD — Full Codebase Audit
> Methodology: Every number below is derived from grep/PowerShell counts run directly against the source tree. Commands are shown so you can re-run them.

---

## 1. TOTAL API ENDPOINTS

**Grep command used:**
```powershell
Select-String -Path "server\routes\<file>" -Pattern "router\.(get|post|put|delete|patch)\(" | Measure-Object
```

| Route File | HTTP Verbs Found | Count |
|---|---|---|
| `auth.routes.js` | POST /register, POST /login, POST /verify-email, POST /resend-otp, POST /forgot-password, POST /reset-password, GET /me, PUT /update-profile, PUT /change-password, POST /logout | **10** |
| `product.routes.js` | GET /, GET /:id, GET /seller/my-products, POST /, PUT /:id, DELETE /:id, PATCH /:id/restock | **7** |
| `order.routes.js` | GET /, GET /seller/analytics, GET /:id, GET /:id/receipt, POST /, POST /create-for-payment, PATCH /:id/confirm-delivery, PATCH /:id/cancel, PATCH /:id/ship | **9** |
| `payment.routes.js` | POST /ipn, POST /success, POST /fail, POST /cancel, POST /initiate | **5** |
| `wallet.routes.js` | POST /deposit/success, POST /deposit/fail, POST /deposit/cancel, GET /balance, POST /deposit, POST /withdraw, GET /transactions | **7** |
| `dispute.routes.js` | POST /, GET /, POST /:disputeId/resolve-buyer-favor, POST /:disputeId/resolve-seller-favor | **4** |
| `chat.routes.js` | POST /, GET /:orderId | **2** |
| `review.routes.js` | GET /product/:productId, GET /seller/:sellerId, GET /my-reviews, GET /eligibility/:orderId, GET /can-review/:productId, POST /, POST /:id/reply | **7** |
| `qa.routes.js` | GET /product/:productId, POST /product/:productId, PUT /:id/answer, DELETE /:id, GET /seller/pending | **5** |
| `upload.routes.js` | POST / (image), POST /video | **2** |
| `admin.routes.js` | POST /login, GET /dashboard, GET /users, GET /users/:id, GET /users/:id/products, PATCH /users/:id/block, PATCH /users/:id/unblock, PATCH /users/:id/role, GET /orders, PATCH /orders/:id/hold, PATCH /orders/:id/release, PATCH /orders/:id/refund, POST /orders/:id/simulate-delivery, POST /orders/:id/simulate-status, PATCH /products/:id/ban, PATCH /products/:id/unban, PATCH /reviews/:id/hide, GET /settings, PATCH /settings | **19** |
| `courierEscrow.routes.js` | POST /pathao-webhook | **1** |
| `/api/health` (server.js inline) | GET /api/health | **1** |

### ✅ TOTAL: 79 API endpoints

---

## 2. DATA MODELS

**Command:**
```powershell
Get-ChildItem -Path "server\models" -File | Select-Object Name
```

**10 Mongoose models:**

| # | File | Model Name | Purpose |
|---|---|---|---|
| 1 | `Dispute.model.js` | Dispute | Buyer dispute cases with video proof |
| 2 | `IdempotencyKey.model.js` | IdempotencyKey | Prevents duplicate payment processing |
| 3 | `Message.model.js` | Message | Order-scoped chat messages |
| 4 | `Order.model.js` | Order | Purchase orders with escrow state |
| 5 | `Product.model.js` | Product | Listings with stock/price/images |
| 6 | `Question.model.js` | Question | Buyer Q&A on product pages |
| 7 | `Review.model.js` | Review | Star ratings + seller replies |
| 8 | `SystemSetting.model.js` | SystemSetting | Admin-configurable platform settings |
| 9 | `Transaction.model.js` | Transaction | Wallet credit/debit ledger |
| 10 | `User.model.js` | User | Buyers, Sellers, Admin accounts |

### ✅ TOTAL: 10 Mongoose models

---

## 3. FRONTEND SCALE

### 3a. Page Components (`/client/src/pages/`)

**Command:**
```powershell
Get-ChildItem -Path "client\src\pages" -Recurse -File -Include "*.jsx","*.js" | Select-Object FullName
```

| Category | Pages | Count |
|---|---|---|
| **admin/** | AdminDashboard, AdminDisputes, AdminLogin, AdminOrders, AdminSellerProducts, AdminSettings, AdminSimulator, AdminUserDetails, AdminUsers | **9** |
| **auth/** | ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage | **4** |
| **buyer/** | HomePage, OrderDetail, PaymentStatusPage, PlaceOrderPage, ProductDetail, ProfilePage, WalletPanel | **7** |
| **seller/** | CreateProductPage, EditProductPage, SellerAnalytics, SellerOrders, SellerProducts, SellerReviewsPage | **6** |

### ✅ TOTAL: 26 page components (9 admin + 4 auth + 7 buyer + 6 seller)

---

### 3b. Reusable Components (`/client/src/components/`)

**Command:**
```powershell
Get-ChildItem -Path "client\src\components" -Recurse -File -Include "*.jsx","*.js" | Select-Object Name, DirectoryName
```

| Component | Category |
|---|---|
| `LogoIcon.jsx` | brand/ |
| `CartDrawer.jsx` | cart/ |
| `OrderChat.jsx` | chat/ |
| `CourierStatusTimeline.jsx` | courier/ |
| `DisputeForm.jsx` | courier/ |
| `AdminLayout.jsx` | layout/ |
| `Navbar.jsx` | layout/ |
| `EscrowTracker.jsx` | product/ |
| `ProductCard.jsx` | product/ |
| `StockBadge.jsx` | product/ |
| `QASection.jsx` | review/ |
| `ReviewSection.jsx` | review/ |
| `StarRating.jsx` | review/ |
| `WriteReview.jsx` | review/ |
| `RouteGuards.jsx` | routes/ |

### ✅ TOTAL: 15 reusable components

---

### 3c. Custom Hooks (`/client/src/hooks/`)

**Command:**
```powershell
Get-ChildItem -Path "client\src\hooks" -Recurse -File -Include "*.js","*.jsx"
```

| Hook | File |
|---|---|
| `useProduct` | `useProduct.js` |

### ✅ TOTAL: 1 custom hook

---

### 3d. Context Providers (`/client/src/context/`)

**Command:**
```powershell
Get-ChildItem -Path "client\src\context" -Recurse -File -Include "*.jsx","*.js"
```

| Context | File |
|---|---|
| `AuthContext` | `AuthContext.jsx` |
| `CartContext` | `CartContext.jsx` |

### ✅ TOTAL: 2 context providers

---

## 4. SOCKET.IO EVENTS

**Finding:** The chat system does **NOT use Socket.IO**. There is no `/server/sockets/` directory and no `socket.io` package in `server/package.json`. The `OrderChat.jsx` component implements **HTTP long-polling** (every 4 seconds via `setInterval`) against the REST `/api/chat` endpoint. Browser push Notifications API is used for unread badge notifications.

**Real-time mechanism:**
- Client polls `GET /api/chat/:orderId` every **4,000ms**
- On new messages when chat is closed: increments unread badge + fires native `Notification` API

### ✅ TOTAL SOCKET.IO EVENTS: 0 — chat uses REST polling, not WebSockets

---

## 5. MIDDLEWARE / SECURITY LAYERS

### Global Middleware (applied to all `/api/*` routes via `server.js`)

| Middleware | Package | Scope | What it does |
|---|---|---|---|
| `helmet()` | `helmet` ^7.1.0 | **Global** | Sets 15+ security HTTP headers |
| `cors()` | `cors` ^2.8.5 | **Global** | Restricts origin to `CLIENT_URL`, allows specific methods/headers |
| `rateLimit` (general) | `express-rate-limit` | **Global `/api/*`** | 100 req / 15 min per IP |
| `rateLimit` (auth) | `express-rate-limit` | **`/api/auth` only** | 20 req / 15 min (stricter) |
| `express.json({ limit: '10kb' })` | Express built-in | **Global** | Body parse + 10KB payload cap |
| `express.urlencoded()` | Express built-in | **Global** | Form parse + 10KB cap |
| `mongoSanitize()` | `express-mongo-sanitize` | **Global** | Strips `$` and `.` from request data (NoSQL injection prevention) |
| `morgan('dev'/'combined')` | `morgan` | **Global** (env-based) | HTTP request logger |

### Per-Route Middleware

| Middleware | File | Applied On |
|---|---|---|
| `protect` (JWT auth) | `auth.middleware.js` | All protected routes across all route files |
| `roleGuard('buyer'/'seller'/'admin')` | `role.middleware.js` | Role-specific endpoints (e.g. seller-only product creation, buyer-only order placement, admin-only management) |
| `idempotencyGuard` | `idempotency.middleware.js` | `POST /api/payment/initiate` (header-based key) |
| `idempotencyGuardByField` | `idempotency.middleware.js` | `POST /api/payment/ipn` (key derived from `tran_id` body field) |
| `upload.single('image')` | `upload.middleware.js` | `POST /api/upload` — Cloudinary image upload via Multer |
| `upload.uploadVideo.single('video')` | `upload.middleware.js` | `POST /api/upload/video` — Cloudinary video upload (max 100MB) |
| `errorHandler` | `error.middleware.js` | **Global** (last middleware) — Centralized error formatting |

**Double-guard pattern on admin routes:** All admin routes (except `/api/admin/login`) run both `protect` AND `roleGuard('admin')` via `router.use(protect, roleGuard('admin'))`.

---

## 6. CODEBASE SIZE

**Command:**
```powershell
$serverFiles = Get-ChildItem -Path "server" -Recurse -Include "*.js" | Where-Object { $_.FullName -notlike "*node_modules*" }
$clientFiles = Get-ChildItem -Path "client\src" -Recurse -Include "*.js","*.jsx","*.ts","*.tsx","*.css"
$serverLines = $serverFiles | Get-Content | Measure-Object -Line
$clientLines = $clientFiles | Get-Content | Measure-Object -Line
```

| Area | Files | Lines |
|---|---|---|
| **Backend** (server/, excl. node_modules) | 48 | 6,707 |
| **Frontend** (client/src/) | 53 | 8,511 |
| **TOTAL** | **101** | **15,218** |

> Note: client file count includes `.css` files. Both counts exclude `node_modules`.

---

## 7. THIRD-PARTY INTEGRATIONS

**Source:** `server/package.json` dependencies + code-verified service files.

| # | Integration | Package | Used For | Verified In |
|---|---|---|---|---|
| 1 | **SSLCommerz** | `sslcommerz-lts` ^1.2.0 | Payment gateway for order & wallet deposits (BD-local) | `payment.controller.js`, `wallet.controller.js` |
| 2 | **Pathao** | `axios` (direct API calls) | Courier/logistics integration (OAuth token + shipment creation/tracking) | `services/pathao.service.js`, `controllers/courierEscrow.controller.js` |
| 3 | **Cloudinary** | `cloudinary` ^1.41.3 + `multer-storage-cloudinary` ^4.0.0 | Image & video hosting (product images, dispute unboxing videos) | `middleware/upload.middleware.js`, `config/cloudinary.js` |
| 4 | **Nodemailer** | `nodemailer` ^9.0.1 | Transactional emails (OTP verification, password reset) | `utils/sendEmail.js` |
| 5 | **PDFKit** | `pdfkit` ^0.19.1 | Order receipt PDF generation | `utils/generateReceiptPdf.js` |
| 6 | **MongoDB/Mongoose** | `mongoose` ^8.4.1 | Primary database ODM | All models |
| 7 | **node-cron** | `node-cron` ^4.5.0 | Scheduled cron job for escrow auto-release | `controllers/courierEscrow.controller.js` (`startEscrowCronJob`) |
| 8 | **bcryptjs** | `bcryptjs` ^2.4.3 | Password hashing | `auth.controller.js` |
| 9 | **jsonwebtoken** | `jsonwebtoken` ^9.0.2 | JWT auth token generation/verification | `utils/generateToken.js` |
| 10 | **validator** | `validator` ^13.12.0 | Input sanitization/validation | Controllers |
| 11 | **Framer Motion** | `framer-motion` ^11.2.12 | Client-side animations | Multiple React components |

**Client-only:**
- `react-router-dom` ^6.24.0 — SPA routing
- `axios` ^1.7.2 — HTTP client
- `lucide-react` ^1.23.0 — Icon library

**Nothing is missing from your list.** SSLCommerz ✅ Pathao ✅ Cloudinary ✅ Nodemailer ✅ PDFKit ✅ — all confirmed in `package.json` and verified in code.

---

## 8. DATABASE COLLECTIONS IN USE

**Seed data situation:** The only seeder is `server/utils/adminSeeder.js` — it creates **1 admin user** and nothing else (idempotent). There is **no product/order/review seed data** in the codebase.

| Collection | Maps to Model | Can claim in production? |
|---|---|---|
| `users` | User | — |
| `products` | Product | — |
| `orders` | Order | — |
| `transactions` | Transaction | — |
| `disputes` | Dispute | — |
| `messages` | Message | — |
| `reviews` | Review | — |
| `questions` | Question | — |
| `systemsettings` | SystemSetting | — |
| `idempotencykeys` | IdempotencyKey | — |

**Verdict:** With no seed data and a fresh dev DB you'd have 1 admin user and 0 documents in every other collection. You **cannot honestly claim any number like "supports X+ listings"** unless you have a live production database. You can truthfully say:
- "Supports 10 distinct data collections"
- "Architecture designed to scale to [X] listings" — but only if you have load-test data
- If you have a real production deployment, connect to that MongoDB Atlas instance and run `db.<collection>.countDocuments()` per collection for real numbers.

---

## SUMMARY SCORECARD

| Metric | Count |
|---|---|
| API Endpoints | **79** |
| Mongoose Models | **10** |
| Page Components | **26** |
| Reusable Components | **15** |
| Custom Hooks | **1** |
| Context Providers | **2** |
| Socket.IO Event Types | **0** (REST polling) |
| Global Middleware Layers | **8** |
| Per-Route Middleware Types | **6** |
| Total LOC (excl. node_modules) | **15,218** |
| Backend LOC | **6,707** |
| Frontend LOC | **8,511** |
| Third-Party Integrations | **11** (7 server-side, 4 client-side) |
| DB Collections | **10** |
