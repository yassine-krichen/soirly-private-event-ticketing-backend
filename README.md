# Soirly Backend

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![Winston](https://img.shields.io/badge/Winston-Logging-231F20?style=flat&logo=winston&logoColor=white)

A **social event management platform** where users create private events, invite friends via links, handle payments, generate tickets, and manage check-ins.

Built with **NestJS**, **Prisma**, **PostgreSQL**, and **Konnect** (payment processing).

---

## What is Soirly?

Soirly helps people organize private events with friends by:

- Creating events with entry prices
- Generating shareable invite links
- Processing payments securely (Konnect integration)
- Issuing QR code tickets
- Managing event check-ins

Think of it as **"Split the bill, but for events"** — organizers set a price, attendees pay their share, everyone gets a ticket.

---

## User Journey

```mermaid
sequenceDiagram
    participant O as Organizer
    participant A as Attendee
    participant S as Backend
    participant K as Konnect (Payment)

    Note over O: 1️⃣ Create Event
    O->>S: POST /events (title, date, price)
    S-->>O: Event + inviteToken

    Note over O: 2️⃣ Share Invite Link
    O->>A: Send invite link with token

    Note over A: 3️⃣ Join Event
    A->>S: GET /events/invite/:token (preview)
    S-->>A: Event details
    A->>S: POST /invitations/join/:token
    S-->>A: Invitation (status: PENDING)

    Note over A: 4️⃣ Pay Entry Fee
    A->>S: POST /payments
    S->>K: Create payment link
    K-->>S: Payment URL
    S-->>A: Payment URL
    A->>K: Complete payment
    K->>S: Webhook (payment success)
    S->>S: Update invitation → CONFIRMED
    S->>S: Generate ticket (QR code)

    Note over A: 5️⃣ Get Ticket
    A->>S: GET /tickets/me
    S-->>A: Ticket with QR code

    Note over O,A: 6️⃣ Event Day - Check-In
    O->>S: POST /events/:id/checkin (scan QR)
    S->>S: Validate ticket
    S-->>O: ✅ Attendee checked in
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

Create `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/soirly"

# Auth
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-secret"

# Konnect Payment
KONNECT_API_KEY="your-konnect-key"
KONNECT_WALLET_ID="your-wallet-id"
KONNECT_WEBHOOK_SECRET="your-webhook-secret"

# Security
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:19006"
```

### 3. Run Migrations

```bash
npx prisma migrate dev
```

### 4. Start Server

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run start:prod
```

Server runs on **http://localhost:3000**

---

## Database Schema

See `prisma/schema.prisma` for the complete database schema.

Use the [Prisma Generate UML](https://marketplace.visualstudio.com/items?itemName=AbianS.prisma-generate-uml) VS Code extension to visualize relationships.

---

## Testing

Use `.http` files with the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VS Code extension for manual testing.

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## License

See `LICENSE` file for details.
