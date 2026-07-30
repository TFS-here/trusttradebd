# TrustTrade BD 🛡️

> **A secure peer-to-peer (P2P) escrow marketplace for Bangladesh** — connecting buyers and sellers with a trusted payment protection layer.

---

## 📌 Overview

TrustTrade BD is a full-stack web application that enables safe online trading between buyers and sellers in Bangladesh. By acting as a neutral escrow intermediary, it holds payments securely until both parties fulfill their obligations — eliminating the risk of fraud in P2P transactions.

### Key Highlights
- 🔒 **Escrow-based payments** powered by SSLCommerz
- 📦 **Courier integration** via Pathao API
- 💬 **Real-time chat** between buyers and sellers (Socket.IO)
- ⚖️ **Dispute resolution** system with admin oversight
- 👛 **Wallet system** for internal fund management
- 📊 **Admin dashboard** for platform control

---

## ✨ Features

### 👤 Authentication & Roles
- JWT-based authentication with expiry and secure cookies
- Three roles: **Buyer**, **Seller**, **Admin**
- Secure password hashing with `bcryptjs`

### 🛍️ Product Management
- Sellers can list, edit, and delete products
- Image upload via **Cloudinary**
- Product Q&A section with seller responses
- Review and rating system

### 🛒 Order & Escrow Flow
1. Buyer places an order and pays via **SSLCommerz**
2. Funds are held in escrow
3. Seller ships via **Pathao** courier
4. Buyer confirms delivery → funds released to seller's wallet
5. Either party can open a **dispute** if needed

### 💬 Real-time Chat
- Messaging via **Socket.IO** per order thread
- Buyer ↔ Seller communication within each order

### ⚖️ Dispute Resolution
- Buyers or sellers can raise disputes on any order
- Admins review and resolve with payout decisions
- Automatic fund release or refund upon resolution

### 👛 Wallet
- Internal wallet for sellers to receive released escrow funds
- Full transaction history and balance management

### 🛡️ Admin Dashboard
- Manage users, products, orders, and disputes
- System settings and platform analytics
- Seller product approval/rejection controls

---

## 🏗️ Tech Stack

### Frontend (`/client`)
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server |
| **React Router v6** | Client-side routing |
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Animations & transitions |
| **Lucide React** | Icon library |
| **Axios** | HTTP client |

### Backend (`/server`)
| Technology | Purpose |
|---|---|
| **Node.js / Express** | REST API server |
| **MongoDB / Mongoose** | Database |
| **Socket.IO** | Real-time communication |
| **JWT** | Authentication tokens |
| **SSLCommerz** | Payment gateway (Bangladesh) |
| **Pathao API** | Courier & delivery integration |
| **Cloudinary + Multer** | Image storage & upload |
| **Nodemailer** | Email notifications |
| **PDFKit** | Invoice/receipt generation |
| **Helmet** | HTTP security headers |
| **express-rate-limit** | Brute-force protection |

---

## 📁 Project Structure

```
trustTradeBD/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── api/                # Axios API utilities
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # React context providers
│   │   ├── hooks/              # Custom React hooks
│   │   ├── pages/
│   │   │   ├── admin/          # Admin panel pages
│   │   │   ├── auth/           # Login / Register pages
│   │   │   ├── buyer/          # Buyer-facing pages
│   │   │   └── seller/         # Seller-facing pages
│   │   └── utils/              # Helper utilities
│   ├── index.html
│   └── vite.config.js
│
├── server/                     # Express backend
│   ├── config/                 # DB and app configuration
│   ├── controllers/            # Route handler logic
│   ├── middleware/             # Auth, error, upload middleware
│   ├── models/                 # Mongoose data models
│   │   ├── User.model.js
│   │   ├── Product.model.js
│   │   ├── Order.model.js
│   │   ├── Transaction.model.js
│   │   ├── Dispute.model.js
│   │   ├── Message.model.js
│   │   ├── Review.model.js
│   │   ├── Question.model.js
│   │   ├── SystemSetting.model.js
│   │   └── IdempotencyKey.model.js
│   ├── routes/                 # API route definitions
│   ├── services/               # Business logic services
│   ├── sockets/                # Socket.IO event handlers
│   ├── utils/                  # Utility functions
│   └── server.js               # Entry point
│
└── vercel.json                 # Vercel deployment config
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.0.0
- **MongoDB** (local or Atlas)
- **SSLCommerz** merchant account ([sandbox](https://developer.sslcommerz.com/))
- **Pathao** merchant account ([sandbox](https://merchant.pathao.com))
- **Cloudinary** account ([free tier](https://cloudinary.com))

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/trustTradeBD.git
cd trustTradeBD
```

### 2. Setup the Server

```bash
cd server
cp .env.example .env
npm install
```

Open `.env` and fill in your credentials:

```env
# Server
NODE_ENV=development
PORT=5000

# MongoDB
MONGO_URI=mongodb://localhost:27017/trusttrade_bd

# JWT
JWT_SECRET=your_long_random_secret_minimum_32_chars
JWT_EXPIRES_IN=7d

# Admin Seed
ADMIN_SEED_EMAIL=admin@trusttrade.bd
ADMIN_SEED_PASSWORD=Admin@Secure123!
ADMIN_SEED_NAME=Super Admin

# CORS
CLIENT_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# SSLCommerz
SSLC_STORE_ID=your_store_id
SSLC_STORE_PASSWD=your_store_password
SSLCOMMERZ_IS_SANDBOX=true

# Pathao Courier
PATHAO_BASE_URL=https://api-hermes.pathao.com
PATHAO_CLIENT_ID=your_client_id
PATHAO_CLIENT_SECRET=your_client_secret
PATHAO_USERNAME=your_merchant_email
PATHAO_PASSWORD=your_merchant_password
PATHAO_STORE_ID=your_store_id

# Callback URL (for payment gateway)
API_URL=http://localhost:5000
```

### 3. Setup the Client

```bash
cd ../client
cp .env.example .env
npm install
```

Edit `client/.env`:

```env
VITE_API_URL=http://localhost:5000
```

### 4. Run the App

**Backend** (from `/server`):
```bash
npm run dev
```

**Frontend** (from `/client`):
```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:5000` |

---

## 🔌 API Reference

| Route Prefix | Description |
|---|---|
| `POST /api/auth/*` | Register, login, logout, refresh token |
| `GET/POST /api/products/*` | Product CRUD |
| `GET/POST /api/orders/*` | Order management & escrow lifecycle |
| `POST /api/payment/*` | SSLCommerz initiation & IPN callbacks |
| `GET/POST /api/wallet/*` | Wallet balance & withdrawal |
| `GET/POST /api/disputes/*` | Dispute creation & admin resolution |
| `GET/POST /api/chat/*` | Per-order chat messages |
| `GET/POST /api/reviews/*` | Product & seller reviews |
| `GET/POST /api/qa/*` | Product Q&A |
| `POST /api/upload/*` | Image uploads to Cloudinary |
| `GET/POST /api/admin/*` | Admin operations |

---

## 🌐 Deployment (Vercel)

This project includes a `vercel.json` for full-stack deployment on Vercel.

```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy from project root
vercel
```

> ⚠️ Add all environment variables from `.env` to the Vercel project dashboard before deploying.

---

## 🔐 Security Features

| Feature | Library |
|---|---|
| Secure HTTP headers | `helmet` |
| Brute-force protection | `express-rate-limit` |
| NoSQL injection prevention | `express-mongo-sanitize` |
| Password hashing | `bcryptjs` |
| Stateless auth | `jsonwebtoken` |
| Duplicate payment prevention | Idempotency keys (MongoDB) |

---

## 📄 License

This project is for educational and personal use. All rights reserved © TrustTrade BD.

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

1. Fork the repository
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'Add some feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

<p align="center">Made with ❤️ for secure trading in Bangladesh 🇧🇩</p>
