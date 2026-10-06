# ĀroHana (आरोहण)
> **"Fair Rides. Trusted Drivers. Safer Journeys."**

ĀroHana is an authentic, production-ready web application for fair ride-hailing in India. Built with **React 18 + Vite + Tailwind CSS**, **Mapbox GL JS v3**, **Firebase Auth & Firestore**, and **Tesseract.js** for client-side OCR driver verification.

---

## 🌟 Key Architecture Pillars

1. **Strict 25% Fair Surge Cap**
   - Fare formula: $\text{fare} = \text{base} + (\text{perKm} \times \text{km}) + (\text{perMin} \times \text{min})$.
   - Surge component is mathematically determined by live demand-to-supply ratio and hard-capped at 25% ($\min(\text{rawSurge}, 25\%)$).
   - Re-verified in Firestore security rules before ride creation.

2. **4-Way Client-Side Document OCR (Tesseract.js)**
   - Drivers upload: Driving License (DL), Vehicle Registration (RC), Government ID (Aadhaar/Voter), and Comprehensive Insurance.
   - Browser-based OCR extracts DL numbers, RC plate numbers, and expiry dates using Indian transport regex patterns.
   - Automated checks verify that names match, dates are not expired, and RC matches vehicle registration.
   - **Enforced Rule:** A driver **cannot go online** unless `verificationStatus == "VERIFIED"`.

3. **GPS Fraud Detection Engine**
   - High-frequency breadcrumb coordinates collected during `RIDE_STARTED`.
   - On completion, automated audit computes:
     - Actual GPS distance vs planned route distance (variance %)
     - Peak speeds (&gt;120 km/h, or &gt;80 km/h for auto/moto)
     - Sudden coordinate jumps (&gt;500m in under 3s)
     - Telemetry gaps (&gt;30s)
     - Corridor deviation (&gt;300m away from planned polyline)
   - Risk classification: `NORMAL`, `WARNING`, `SUSPICIOUS` with neutral reporting ("flagged for review").

4. **Emergency SOS & Safety Center**
   - 2-second hold-to-activate button prevents accidental triggers.
   - Broadcasts real-time coordinates to the Admin Safety Center until resolved.
   - 1-tap call to India National Emergency **112**.
   - Direct WhatsApp alert with Google Maps coordinates link.

5. **Private Trusted-Contact Live Tracking**
   - Generates a 32-byte cryptographically secure random token (`crypto.getRandomValues`), stored as a SHA-256 hash.
   - Public view at `/track/:token` requires zero login, displaying only first names, masked vehicle registration (e.g. `DL 01 ** 9876`), pickup, drop-off, and live animated vehicle location.
   - Phone numbers, emails, and payment information remain strictly redacted.

---

## 🚀 Setup & Environment Variables

Copy `.env.example` to `.env`:

```bash
# Mapbox Public Access Token (Get a free public token from https://mapbox.com)
VITE_MAPBOX_TOKEN="pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUwMDAwMDExMnh4YW1wbGUifQ.example"

# Firebase Web Configuration (From Firebase Console -> Project Settings -> General -> Your Web App)
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"
VITE_FIREBASE_FIRESTORE_DATABASE_ID="(default)"

VITE_DEMO_MODE="true"
```

> **Note:** If `VITE_MAPBOX_TOKEN` is missing or placeholder, the application displays a friendly **"Map Configuration Required"** panel and never silently renders a fake map.

---

## 👥 Seed Accounts & Demo Profiles

ĀroHana includes seeded demo accounts for rapid testing without manual registration:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@arohana.in` | `Admin@123` | Full access to Driver Verification, Fraud Audits, Safety Center & Pricing |
| **Rider** | `rider@arohana.in` | `Rider@123` | Pre-configured with trusted contact (Dr. Ramesh Deshmukh) |
| **Driver (Sedan)** | `driver@arohana.in` | `Driver@123` | **VERIFIED** Sedan driver (Honda City, DL01AB9876) |
| **Driver (Moto)** | `driver2@arohana.in` | `Driver@123` | **VERIFIED** Moto driver (Hero Splendor, MH12CD4567) |
| **Driver (Auto)** | `driver3@arohana.in` | `Driver@123` | **VERIFIED** Auto driver (Bajaj RE, KA01EF1122) |

---

## 📱 Testing GPS over HTTPS on a Phone

Browsers enforce that `navigator.geolocation.watchPosition` with `enableHighAccuracy: true` **only operates over secure contexts (`https://` or `localhost`)**.

1. When running in Google AI Studio, access the development or shared preview URL:
   `https://ais-dev-5wmubbu73arnfb2v6yzhlf-158350164321.asia-southeast1.run.app`
2. Open the URL on your mobile phone browser (Chrome on Android or Safari on iOS).
3. Grant **Location Permission** when prompted.
4. The high-accuracy blue dot and accuracy circle will immediately render. If accuracy is over 150m, a yellow banner reminds you to drag the pickup pin.

---

## 🧪 Two-Device Live Test Script (Rider on Laptop, Driver on Phone)

### Step 1: Prepare the Driver (Phone)
1. Open the app on your phone and navigate to `/auth`.
2. Tap **"Driver"** in Quick Demo Logins, or enter `driver@arohana.in` / `Driver@123`.
3. In the Driver Console, tap **"GO ONLINE"**.
4. Allow geolocation permission and observe the green **ONLINE** pulse and Screen Wake Lock activation.

### Step 2: Book the Ride (Laptop)
1. Open the app on your laptop and navigate to `/auth`.
2. Tap **"Rider"** in Quick Demo Logins (`rider@arohana.in`).
3. Navigate to **Book Ride** (`/book`).
4. Select a destination (search any Indian landmark, e.g., "MG Road", "Airport", "Connaught Place").
5. Observe the transparent fare breakdown with capped surge.
6. Click **Confirm SEDAN · Book Ride**.

### Step 3: Accept & Lifecycle (Phone -> Laptop)
1. On the phone (Driver Console), the ride request immediately appears within the 5 km radius list with a 20s countdown.
2. Tap **Accept Request**.
3. On the laptop, the Rider screen updates in real time to **DRIVER ASSIGNED** with driver details.
4. On the phone, tap **"I Have Arrived at Pickup"**.
5. Once within 200m of the pickup point, tap **"Start Ride (200m Verification)"**.
6. On the laptop, the rider map transitions to **RIDE STARTED** and smoothly animates the driver's vehicle marker with live heading and coordinates.
7. Tap **"Share Live Track"** on the laptop to test WhatsApp trusted contact tracking (`/track/:token`).
8. On the phone, tap **"Complete Ride & Record Telemetry"**.
9. The GPS Fraud Audit algorithm automatically evaluates the trajectory and posts a report to the Admin Center.
10. The rider rates the trip (1–5 stars) and completes payment via UPI / Cash / Card.

---

## 🕐 Time-Slot Pre-Booking & Cloud Trigger Architecture

ĀroHana supports advance ride scheduling up to 30 days ahead with 30-minute time slots (12-hour AM/PM format) in the rider's local timezone.

### Production Trigger Architecture:
In the current serverless demo environment, `promoteDueScheduledRides()` runs safely every 30 seconds across active app sessions with Firestore transactions to prevent duplicate activations.

**In Production Deployment:**
This trigger should be deployed as a **Google Cloud Function (Firebase Cloud Function) triggered by Cloud Scheduler**:
- **Cloud Scheduler**: Invokes the function once every 1 minute (`* * * * *`).
- **Cloud Function**: Executes the exact `promoteDueScheduledRides()` routine defined in `src/lib/prebooking.ts`.
- **Zero Client Dependency**: Scheduled rides are activated on time even when the user's phone or browser is completely closed. The core logic in `src/lib/prebooking.ts` is already modular and isolated so only the invocation trigger changes from the browser interval to the Cloud Function handler.

---

## 📞 PC Hackathon Call Demo Mode

When running on desktop or Windows PC for hackathon judging:
- Cellular `tel:+91...` launching is suppressed, preventing the Windows "Select an app to open this 'tel' link" popup.
- An in-browser voice call session displays contact details, connection status, audio toggles (`[Mute]`, `[Speaker]`, `[End Call]`), and live timer (`00:00...`), clearly labeled as `PC HACKATHON DEMO — Voice call simulation`.
- If a real WebRTC voice provider is configured, the system automatically transitions to `🟢 REAL VOICE CALL`.

---

## 🛡️ Firestore Security Rules (`firestore.rules`)

- **Users**: Read/write their own profile (`isOwner(userId)`). Role modification restricted strictly to `isAdmin()`.
- **Drivers**: Online state modification permitted only if `verificationStatus == "VERIFIED"`.
- **Driver Documents**: Restricted to the owner driver and platform admins.
- **Rides**:
  - Ride creation strictly validates that `finalFare <= maxAllowedFare`.
  - State transitions follow strict workflow (`REQUESTED -> DRIVER_ASSIGNED -> DRIVER_ARRIVING -> DRIVER_ARRIVED -> RIDE_STARTED -> RIDE_COMPLETED -> PAYMENT_COMPLETED`).
- **Emergency Alerts**: Real-time read access for rider, assigned driver, and admin.
- **Tracking Tokens**: Public read allowed by token hash; sensitive user fields redacted.

---

## 🔧 Troubleshooting

- **Map shows "Map Configuration Required"**:
  Ensure you entered your public Mapbox token in `.env` (`VITE_MAPBOX_TOKEN`) or enter it directly into the in-app activation prompt.
- **Driver cannot go online**:
  Ensure the driver's verification status is `VERIFIED`. For newly registered drivers, visit `/driver/verify` to run OCR and approve the profile in `/admin`.
- **GPS accuracy warning (&gt;150m)**:
  Common when running inside indoor desktop environments with Wi-Fi triangulation. Drag the pin on the map to set the exact curb pickup location.
- **Cannot start ride**:
  The driver must be within 200m of the pickup coordinates. Check the distance meter displayed on the button.
