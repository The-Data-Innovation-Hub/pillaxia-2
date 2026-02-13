# Pillaxia Companion

A comprehensive healthcare medication management platform with multi-role support for patients, clinicians, pharmacists, and administrators. Built with a focus on medication adherence, multi-channel notifications, and offline-first capabilities.

## 🏥 Overview

Pillaxia Companion helps patients manage their medications effectively while enabling healthcare providers to monitor adherence, intervene when needed, and improve health outcomes. The platform supports:

- **Patients**: Medication tracking, dosing schedules, symptom logging, caregiver support
- **Clinicians**: Patient roster management, adherence monitoring, clinical decision support, e-prescribing
- **Pharmacists**: Prescription fulfillment, inventory management, controlled substance tracking, drug recalls
- **Administrators**: User management, organization settings, compliance reporting, analytics

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** + **shadcn/ui** for styling
- **React Query** for server state management
- **React Router** for navigation
- **Framer Motion** for animations

### Backend (Lovable Cloud)
- **PostgreSQL** database with Row Level Security (RLS)
- **Edge Functions** for serverless logic
- **Authentication** with MFA, trusted devices, and session management
- **Real-time** subscriptions for live updates

### Mobile
- **Capacitor** for iOS and Android native apps
- **Native Push Notifications** (APNS, FCM)
- **Biometric Authentication** support

### External Integrations
- **Resend** for transactional emails
- **Twilio** for SMS and WhatsApp
- **Stripe** for organization billing

## 📁 Project Structure

```
├── src/
│   ├── components/          # React components by domain
│   │   ├── admin/           # Admin dashboard components
│   │   ├── clinician/       # Clinician-facing components
│   │   ├── patient/         # Patient-facing components
│   │   ├── pharmacist/      # Pharmacist-facing components
│   │   ├── landing/         # Public landing page
│   │   ├── shared/          # Cross-role shared components
│   │   └── ui/              # Base UI components (shadcn)
│   ├── contexts/            # React Context providers
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility libraries
│   │   ├── cache/           # IndexedDB caching layer
│   │   ├── offlineQueue.ts  # Offline action queue
│   │   └── conflictResolution.ts
│   ├── i18n/                # Internationalization (EN, YO, IG, HA)
│   └── integrations/        # External service clients
├── supabase/
│   └── functions/           # Edge Functions
│       ├── _shared/         # Shared utilities
│       └── [function-name]/ # Individual functions
├── e2e/                     # Playwright E2E tests
└── docs/                    # Documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or bun

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd pillaxia-companion

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

The following environment variables are automatically configured in Lovable Cloud:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

For **local dev with Azure/Entra sign-in**, copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `VITE_ENTRA_CLIENT_ID` | Entra app registration (client) ID |
| `VITE_ENTRA_TENANT_ID` | Entra directory (tenant) ID |
| `VITE_ENTRA_EXTERNAL_ID_AUTHORITY` | Authority URL, e.g. `https://login.microsoftonline.com/{tenant-id}/` |
| `VITE_ENTRA_REDIRECT_URI` | Web: `http://localhost:5173/auth/callback` (must match app registration) |
| `VITE_AZURE_FUNCTIONS_URL` | Azure Functions base URL (for `/api/me` and `/api/auth-exchange-native`) |

See `.env.example` for the full list and optional overrides.

**Why it works remotely but not locally:** The deployed app at Azure Static Web Apps (e.g. `https://ashy-bush-075a67503.1.azurestaticapps.net/`) receives `VITE_ENTRA_*` and `VITE_AZURE_FUNCTIONS_URL` from the pipeline (GitHub Actions secrets). Locally, Vite only reads from your `.env` file. If those variables are empty locally, sign-in will fail (missing client ID/authority) or you’ll get no profile/roles (missing `VITE_AZURE_FUNCTIONS_URL`). **Fix:** Copy the same values you use in production into your local `.env` (client ID, tenant, authority, and Azure Functions URL). For redirect URI keep `http://localhost:5173/auth/callback` and add that exact URI in the Entra app registration under **Authentication → Redirect URIs** so Microsoft can redirect back to your dev server.

## 🧪 Testing

### Unit Tests (Vitest)

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

**Coverage Thresholds:**
- Statements: 40%
- Branches: 35%
- Functions: 40%
- Lines: 40%

### E2E Tests (Playwright)

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

### Test Structure

```
src/test/           # Unit tests
├── hooks/          # Hook tests
├── lib/            # Library tests
└── components/     # Component tests

e2e/tests/          # E2E tests
├── auth.spec.ts
├── medication-management.spec.ts
├── schedule.spec.ts
└── offline-sync.spec.ts
```

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and data flow
- [Database Schema](docs/DATABASE.md) - Tables, relationships, and RLS policies

## 🔐 Security Features

- **Row Level Security (RLS)** on all tables
- **MFA** with TOTP and recovery codes
- **Trusted Devices** with token-based verification
- **Session Management** with concurrent session limits
- **Audit Logging** for sensitive operations
- **Account Lockout** after failed login attempts

## 🌐 Multi-Channel Notifications

- **Email** via Resend with A/B testing
- **SMS** via Twilio
- **WhatsApp** via Twilio
- **Web Push** via Web Push API
- **Native Push** via APNS/FCM

All channels support:
- User preference management
- Quiet hours
- Delivery tracking and retries
- Engagement analytics

## 📱 Mobile Apps

Built with Capacitor for native iOS and Android:

```bash
# Build web assets
npm run build

# Sync with native projects
npx cap sync

# Open in Xcode
npx cap open ios

# Open in Android Studio
npx cap open android
```

## 🤝 Contributing

1. Create a feature branch
2. Make your changes with tests
3. Ensure all tests pass (`npm test`)
4. Ensure linting passes (`npm run lint`)
5. Submit a pull request

## 📄 License

Proprietary - All rights reserved.
