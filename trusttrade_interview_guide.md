# TrustTradeBD — Interview Study Guide
> Read this top-to-bottom, understand every section, then practice saying it out loud.

---

## 1. "Tell me about this project in 2 minutes."

**Practice this answer:**

> "TrustTradeBD is a full-stack peer-to-peer e-commerce platform with a built-in **escrow system** — similar to how Fiverr or Daraz protects buyers and sellers. When a buyer places an order, the payment is **locked** in escrow. It's only released to the seller after the buyer confirms delivery. If there's a dispute, an admin steps in to resolve it. I built it with the **MERN stack** — MongoDB, Express, React, and Node.js — and deployed it on Vercel."

---

## 2. Tech Stack — What & Why

| Layer | Technology | Why |
|---|---|---|
| Frontend | **React + Vite** | Fast dev server, component-based UI |
| Styling | **Vanilla CSS + Tailwind classes** | Full control, no extra build complexity |
| State Management | **React Context API** | No Redux needed; AuthContext + CartContext was enough |
| Routing | **React Router v6** | Nested routes, protected routes |
| Animations | **Framer Motion** | Smooth page transitions and UI animations |
| Backend | **Node.js + Express** | Lightweight REST API server |
| Database | **MongoDB + Mongoose** | Flexible schema for products/orders/users |
| Auth | **JWT (JSON Web Tokens)** | Stateless, works well with REST APIs |
| Image Upload | **Cloudinary + Multer** | Cloud image storage for products |
| Payment Gateway | **SSLCommerz** | Most popular Bangladesh payment gateway |
| Email | **Nodemailer** | Send OTP verification emails |
| Security | **Helmet, express-rate-limit, mongo-sanitize** | Production-level security |
| Deployment | **Vercel** | Frontend + serverless backend on same platform |

---

## 3. Project Architecture — How Everything Connects

```
Browser (React)
    │
    ├── AuthContext  →  stores JWT in localStorage, adds it to every API request
    │
    ├── React Router  →  protects routes by checking user role (buyer/seller/admin)
    │
    └── Axios (api instance)
            │
            ▼
        Express Server (Node.js)
            │
            ├── Middleware: auth.middleware.js  → verify JWT
            ├── Middleware: role.middleware.js  → check role
            ├── Middleware: rateLimit           → block brute force
            ├── Middleware: mongoSanitize       → block NoSQL injection
            │
            ├── Routes → Controllers → Mongoose Models → MongoDB
            │
            └── SSLCommerz (payment) / Cloudinary (images) / Nodemailer (email)
```

**Key point:** The flow is always:
`Request → Auth Middleware → Route → Controller → Model → Database → Response`

---

## 4. The Core Feature: Escrow System

This is the most important thing about your project. Understand it deeply.

### What is Escrow?
Escrow means a **trusted third party holds the money** until both sides fulfill their obligations.

### How Your Escrow Works (State Machine)

```
PENDING_PAYMENT → LOCKED → SHIPPED → DELIVERED → RELEASED
                     │          │
                     └──────────→ ON_HOLD → REFUNDED
                                          → RETURNED
```

| State | Who triggers it | What happens |
|---|---|---|
| `PENDING_PAYMENT` | System | SSLCommerz order created, waiting for payment |
| `LOCKED` | System | Payment confirmed. Funds held. Seller must ship. |
| `SHIPPED` | Seller | Seller marks item as shipped |
| `DELIVERED` | Buyer | Buyer confirms receipt |
| `RELEASED` | System | Money sent to seller's wallet |
| `ON_HOLD` | Admin | Dispute filed, money frozen |
| `REFUNDED` | Admin | Money returned to buyer |
| `RETURNED` | Admin | Dispute resolved with return |

### Code Location
- **Model:** `server/models/Order.model.js` — defines all states and the `transitionEscrow()` method
- **Controller:** `server/controllers/order.controller.js` — calls `order.transitionEscrow()`

### How to explain `transitionEscrow()`:
> "I have an instance method on the Order model called `transitionEscrow`. It checks a `VALID_TRANSITIONS` map — for example, from `LOCKED` you can only go to `SHIPPED` or `REFUNDED`. If someone tries an invalid transition like `LOCKED → RELEASED`, it throws an error. Every transition also records an audit log with who did it, when, and why — this is stored in the `escrowHistory` array."

---

## 5. Authentication System

### Flow:
1. User registers → server sends OTP to email via Nodemailer
2. User enters OTP → `POST /api/auth/verify-email`
3. Server issues JWT → stored in `localStorage` as `tt_token`
4. Every API request → `AuthContext` axios interceptor adds `Authorization: Bearer <token>`
5. `auth.middleware.js` on server verifies JWT on every protected route

### Two separate auth systems:
- **Users** (buyers/sellers): token key = `tt_token`
- **Admins**: token key = `tt_admin_token`, separate login at `/admin/login`

### Security steps your middleware does (auth.middleware.js):
1. Extract token from `Authorization: Bearer ...` header
2. Verify JWT signature + expiry
3. Check user still exists in DB (handles deleted accounts)
4. Check if user is blocked/inactive
5. Check if password was changed *after* the token was issued (invalidates old tokens)
6. Attach `req.user` to the request

### Code Location: `server/middleware/auth.middleware.js`

---

## 6. Payment Integration — SSLCommerz

### What is SSLCommerz?
Bangladesh's most popular payment gateway (like Stripe for BD). Supports bKash, Nagad, Rocket, cards.

### Two payment methods in your app:
1. **Wallet payment** — buyer uses their in-app wallet balance (instant, no gateway)
2. **SSLCommerz** — buyer pays with bKash/card etc. via redirect

### SSLCommerz flow:
1. Frontend calls `POST /api/payment/initiate`
2. Server creates SSLCommerz session, gets a payment URL
3. User is redirected to SSLCommerz payment page
4. After payment, SSLCommerz sends IPN (Instant Payment Notification) to `POST /api/payment/ipn`
5. Server validates the payment, updates order status from `PENDING_PAYMENT` to `LOCKED`

### Code Location: `server/controllers/payment.controller.js`

### Idempotency (advanced point to impress interviewers):
> "I implemented idempotency keys on payment endpoints using `server/middleware/idempotency.middleware.js`. If the same payment request is sent twice (e.g., network retry), the server returns the cached response instead of charging twice. This prevents double charges."

---

## 7. Role-Based Access Control (RBAC)

Three roles: `buyer`, `seller`, `admin`

```javascript
// role.middleware.js
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden(...));
  next();
};
```

Usage in routes:
```javascript
router.patch('/ship/:id', protect, authorize('seller'), orderController.markShipped);
router.patch('/release/:id', protect, authorize('buyer'), orderController.confirmDelivery);
router.post('/dispute', protect, authorize('admin'), disputeController.resolve);
```

**How to explain:** "Every route that needs authentication uses the `protect` middleware. Then `authorize('seller')` checks that only sellers can access that route. Admins have a completely separate login and JWT token."

---

## 8. Frontend Architecture

### Entry Point Flow:
```
main.jsx → App.jsx → AuthProvider wraps everything → React Router routes
```

### Route Protection:
- `<ProtectedRoute>` — checks if user is logged in, redirects to login if not
- `<AdminRoute>` — checks admin JWT (`tt_admin_token`), redirects to admin login if not
- Role-based redirects: buyers go to `/`, sellers go to `/seller/products`

### Pages by Role:
| Role | Pages |
|---|---|
| Buyer | HomePage, ProductDetail, PlaceOrder, OrderDetail, Wallet, Profile |
| Seller | SellerProducts, CreateProduct, EditProduct, SellerOrders, SellerAnalytics, SellerReviews |
| Admin | Dashboard, Users, Orders, Disputes, Settings, Simulator |

### State Management:
- `AuthContext` — user login state, token management
- `CartContext` — shopping cart (add/remove items, persist in localStorage)

---

## 9. Database Design (MongoDB Models)

| Model | Purpose |
|---|---|
| `User` | Stores buyer/seller info, wallet balance, role, OTP |
| `Product` | Product listings with images, price, seller ref |
| `Order` | Escrow state machine, payment info, shipping, history |
| `Transaction` | Wallet credit/debit history |
| `Dispute` | Dispute records linked to orders |
| `Review` | Buyer reviews after delivery |
| `Message` | Chat messages between buyer and seller |
| `Question` | Q&A on product listings |
| `SystemSetting` | Admin-configurable settings (platform fee %) |
| `IdempotencyKey` | Prevents duplicate payment processing |

### Key MongoDB concepts used:
- **Population** (`ref` + `.populate()`) — e.g., `order.populate('buyer seller')`
- **Indexes** — `orderSchema.index({ buyer: 1, createdAt: -1 })` for fast queries
- **Instance methods** — `order.transitionEscrow()`
- **Virtuals** — computed fields not stored in DB
- **Timestamps** — `{ timestamps: true }` auto-adds `createdAt` and `updatedAt`

---

## 10. Security Features (Important for interviews)

| Feature | How |
|---|---|
| Password hashing | `bcryptjs` — never store plain passwords |
| JWT auth | `jsonwebtoken` — stateless, signed tokens |
| Rate limiting | `express-rate-limit` — 100 req/15min global, 20 req/15min on auth routes |
| NoSQL injection | `express-mongo-sanitize` — strips `$` and `.` from inputs |
| HTTP headers | `helmet` — sets secure headers (XSS, clickjacking protection) |
| Input validation | `validator` library on models |
| Body size limit | `express.json({ limit: '10kb' })` — prevents large payload attacks |
| Idempotency | Custom middleware — prevents duplicate payment processing |

---

## 11. Cloudinary Image Upload Flow

1. Frontend selects image → sends `multipart/form-data` to `POST /api/upload`
2. `multer` middleware (configured with `multer-storage-cloudinary`) intercepts the file
3. File is streamed directly to Cloudinary (never saved to disk)
4. Cloudinary returns a secure URL
5. URL stored in the Product document in MongoDB

### Code Location: `server/middleware/upload.middleware.js`, `server/routes/upload.routes.js`

---

## 12. Admin Panel

The admin panel is completely separate from the main app:
- Separate login at `/admin/login` with its own JWT stored as `tt_admin_token`
- Protected by `AdminRoute` component on frontend
- Separate `admin.routes.js` and `admin.controller.js` on backend

### What admins can do:
- View all users, block/unblock accounts
- View all orders, force state transitions
- Resolve disputes (refund or release funds)
- View platform analytics (revenue, order count)
- Adjust system settings (platform fee percentage)
- Use the Simulator to test payment flows

---

## 13. Pathao Courier Integration

- When seller ships, they can create a Pathao courier booking
- Pathao sends webhook updates with courier status (picked up, in transit, delivered)
- These updates are stored in `order.courierStatusHistory`
- After Pathao confirms delivery, a **cron job** (`node-cron`) automatically schedules fund release 24 hours later
- Code: `server/controllers/courierEscrow.controller.js`

---

## 14. Real-Time Chat

- Buyers and sellers can chat per-order
- Messages stored in `Message` model
- `Socket.IO` used for real-time delivery (code in `server/sockets/`)
- REST fallback via `server/routes/chat.routes.js`

---

## 15. Deployment

- **Frontend + Backend:** Deployed on **Vercel**
- `vercel.json` in root configures Vercel to route `/api/*` to the Express server
- Express exports `module.exports = app` (not `app.listen`) for Vercel serverless
- Images on **Cloudinary CDN**
- Database on **MongoDB Atlas** (cloud)

---

## 16. Common Interview Questions & Your Answers

### Q: "What was the hardest challenge?"
> "The escrow state machine. I had to make sure money could never be released without the correct sequence of events. I solved this with a `VALID_TRANSITIONS` map and a `transitionEscrow()` method that throws an error if an invalid transition is attempted. Every transition is also logged in an audit trail."

### Q: "How do you secure your API?"
> "Multiple layers: JWT authentication on every protected route, role-based authorization middleware, rate limiting to prevent brute force, Helmet for secure HTTP headers, mongo-sanitize to prevent NoSQL injection, and body size limits to prevent payload attacks."

### Q: "Why MongoDB over MySQL?"
> "Products can have very different attributes — an electronics product has specs, a clothing product has sizes and colors. MongoDB's flexible schema lets each product document have its own structure without needing complex SQL JOINs."

### Q: "What is Context API and why not Redux?"
> "Context API is React's built-in state management. I used it for auth state and cart state. The app didn't need Redux because the state wasn't deeply nested or extremely complex — Context with `useReducer` or `useState` was sufficient."

### Q: "Explain JWT."
> "JWT is a JSON Web Token — a signed string containing user data. After login, the server signs a token with a secret key and sends it to the client. The client stores it and sends it back in every request header. The server verifies the signature without needing to query the database every time — that's what makes it stateless."

### Q: "What is idempotency?"
> "If a network request fails and retries, you don't want to charge the user twice. I generate a unique `idempotency-key` on the client for each payment attempt. If the server sees the same key again, it returns the cached response instead of processing the payment a second time."

### Q: "How does SSLCommerz work?"
> "The client calls my backend to initiate a payment. My backend calls the SSLCommerz API and gets a redirect URL. The user is sent to SSLCommerz's page where they pay. After payment, SSLCommerz calls my server's IPN endpoint with the result. My server validates the payment and updates the order status."

---

## 17. 3-Week Study Plan

### Week 1 — Understand the Backend
- Read `server/server.js` top-to-bottom — understand each middleware
- Read `server/models/Order.model.js` — understand the escrow state machine
- Read `server/middleware/auth.middleware.js` — understand JWT flow
- Read `server/controllers/order.controller.js` — understand how orders change state
- Open Postman and manually call each API endpoint

### Week 2 — Understand the Frontend
- Read `client/src/context/AuthContext.jsx` — understand how login/logout works
- Read `client/src/App.jsx` — understand route protection
- Open browser DevTools → Network tab — watch API calls happen as you use the app
- Read one page at a time: `PlaceOrderPage.jsx` → `OrderDetail.jsx` → `WalletPanel.jsx`

### Week 3 — Practice Explaining
- Draw the escrow flow on paper from memory
- Explain the auth flow out loud without looking at notes
- Practice answering each question in Section 16
- Read about the libraries used: JWT, bcrypt, Mongoose, Axios

---

## 18. Key Files to Know by Heart

| File | What it does |
|---|---|
| `server/server.js` | Sets up Express, all middleware, all routes |
| `server/models/Order.model.js` | The escrow state machine — your most complex model |
| `server/middleware/auth.middleware.js` | JWT verification, user hydration |
| `server/middleware/role.middleware.js` | Role-based access control |
| `client/src/context/AuthContext.jsx` | Frontend auth state, token storage, axios interceptor |
| `client/src/App.jsx` | All routes, route protection logic |
| `client/src/components/layout/AdminLayout.jsx` | Admin panel shell with mobile drawer |
