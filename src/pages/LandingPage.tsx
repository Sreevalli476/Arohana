import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import {
  Compass,
  ShieldCheck,
  Zap,
  TrendingDown,
  Lock,
  FileCheck2,
  Share2,
  AlertTriangle,
  ChevronRight,
  MapPin,
  CheckCircle2,
  Users,
  Car,
  Clock,
  HelpCircle,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, login } = useAppStore();
  const navigate = useNavigate();

  const handleQuickLogin = async (role: 'rider' | 'driver' | 'admin') => {
    const creds = {
      admin: { email: 'admin@arohana.in', pass: 'Admin@123' },
      rider: { email: 'rider@arohana.in', pass: 'Rider@123' },
      driver: { email: 'driver@arohana.in', pass: 'Driver@123' },
    }[role];

    await login(creds.email, creds.pass);
    if (role === 'rider') navigate('/book');
    else if (role === 'driver') navigate('/driver');
    else navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32 border-b border-neutral-900">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-amber-600/15 to-amber-400/5 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Pill-less honest subheader */}
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-widest">
              <span>Transparent Urban Mobility</span>
              <span aria-hidden="true">·</span>
              <span>100% Verified Drivers</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Fair Rides. Trusted Drivers.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                Safer Journeys.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed">
              India's first mobility platform built on mathematical fare transparency, 
              client-side OCR driver authentication, live GPS fraud audits, and private trusted-contact sharing.
            </p>

            {/* Main Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/book"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <span>Book a Fair Ride</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/driver"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 font-semibold text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <Car className="w-4 h-4 text-amber-400" />
                <span>Become a Driver</span>
              </Link>
            </div>

            {/* 1-Click Demo Logins for Testing */}
            <div className="pt-6 border-t border-neutral-900 max-w-xl mx-auto">
              <p className="text-xs text-neutral-500 mb-3">Quick Interactive Demo Profiles:</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => handleQuickLogin('rider')}
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-300 transition-colors flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Demo Rider</span>
                </button>
                <button
                  onClick={() => handleQuickLogin('driver')}
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-300 transition-colors flex items-center gap-1.5"
                >
                  <Car className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Demo Driver (Verified)</span>
                </button>
                <button
                  onClick={() => handleQuickLogin('admin')}
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-300 transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                  <span>Demo Admin Center</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Pillars Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <p className="text-xs uppercase font-bold tracking-widest text-amber-400">Why ĀroHana Is Different</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Designed for Dignity, Fairness & Uncompromising Safety
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 transition-colors space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <TrendingDown className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Strict 25% Surge Cap</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              No 3x or 4x extortion fares during rain or rush hours. Surge is dynamically calculated from actual demand-to-driver supply ratios and hard-clamped at 25% in both the app and Firestore security rules.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 transition-colors space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">4-Way Document OCR</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Drivers verify Driving License, RC, Government ID, and Insurance. Tesseract.js validates plate formats, expiry dates, and cross-checks names before an admin approves them to go online.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 transition-colors space-y-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">GPS Fraud Detection</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Automated trip telemetry audit compares recorded breadcrumb distances against the planned route, detecting speed anomalies, ghost jumps, and unauthorized detours.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-neutral-900/30 border-y border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <p className="text-xs uppercase font-bold tracking-widest text-amber-400">Step-by-Step</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Transparent from Pickup to Drop-off
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="text-amber-400 font-mono font-bold text-sm">01. Precise Pickup</div>
              <h4 className="text-sm font-semibold text-white">GPS Pin or Landmark</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Use your device's high-accuracy GPS with accuracy circle display, or search railway stations, colleges, and airports.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="text-amber-400 font-mono font-bold text-sm">02. Fair Surge Pricing</div>
              <h4 className="text-sm font-semibold text-white">Full Cost Breakdown</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                See base fare, distance rate, time rate, and capped surge clearly displayed before requesting.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="text-amber-400 font-mono font-bold text-sm">03. 200m Pickup Lock</div>
              <h4 className="text-sm font-semibold text-white">No Ghost Starts</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                A driver cannot start a trip unless their real GPS coordinates are verified within 200 meters of your pickup point.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="text-amber-400 font-mono font-bold text-sm">04. Private Live Tracking</div>
              <h4 className="text-sm font-semibold text-white">WhatsApp 1-Tap Share</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Share a secure temporary link with family. They track your journey live without needing to download or log in.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & SOS Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-rose-500/20 relative overflow-hidden">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>Dedicated Emergency Architecture</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Safety isn't an afterthought. It's built into every ride.
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Our 2-second hold SOS mechanism prevents accidental triggers while ensuring that true emergencies immediately notify the 24x7 Safety Center, broadcast continuous GPS coordinates, and provide a 1-tap call to India's National Emergency Helpline (112).
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs font-medium text-neutral-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Live coordinate broadcasting
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                1-tap 112 emergency dialer
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                WhatsApp live tracking for family
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Vehicle Tiers */}
      <section className="py-20 bg-neutral-900/30 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <p className="text-xs uppercase font-bold tracking-widest text-amber-400">Available Fleets</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Four Transparent Ride Tiers
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="text-2xl font-bold text-amber-400">Moto</div>
              <p className="text-xs text-neutral-400">Fastest solo ride for bustling traffic</p>
              <div className="pt-2 border-t border-neutral-800 text-xs space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Base Fare</span>
                  <span className="text-white font-semibold">₹25</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Per Km</span>
                  <span className="text-white font-semibold">₹8/km</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="text-2xl font-bold text-amber-400">Auto</div>
              <p className="text-xs text-neutral-400">Everyday pocket-friendly city commute</p>
              <div className="pt-2 border-t border-neutral-800 text-xs space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Base Fare</span>
                  <span className="text-white font-semibold">₹35</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Per Km</span>
                  <span className="text-white font-semibold">₹12/km</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="text-2xl font-bold text-amber-400">Sedan</div>
              <p className="text-xs text-neutral-400">Spacious AC car with top-tier comfort</p>
              <div className="pt-2 border-t border-neutral-800 text-xs space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Base Fare</span>
                  <span className="text-white font-semibold">₹60</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Per Km</span>
                  <span className="text-white font-semibold">₹16/km</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="text-2xl font-bold text-amber-400">SUV XL</div>
              <p className="text-xs text-neutral-400">Premium 6-seater for family & luggage</p>
              <div className="pt-2 border-t border-neutral-800 text-xs space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Base Fare</span>
                  <span className="text-white font-semibold">₹90</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Per Km</span>
                  <span className="text-white font-semibold">₹22/km</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2 mb-10">
          <p className="text-xs uppercase font-bold tracking-widest text-amber-400">Frequently Asked Questions</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Everything You Need to Know</h2>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">How does the 25% surge cap protect riders?</h4>
            <p className="text-neutral-400 leading-relaxed">
              Standard cab apps frequently apply 200% to 400% surge multipliers during high demand. ĀroHana calculates demand transparently and caps the surge component strictly at 25%. Even at maximum peak demand, the final fare can never exceed Base + Distance + Time multiplied by 1.25.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">How does client-side OCR verify drivers?</h4>
            <p className="text-neutral-400 leading-relaxed">
              When a driver uploads their Driving License and Vehicle RC, Tesseract.js runs local text extraction directly in the browser. It checks validity dates, verifies that the vehicle number format matches regional transport office (RTO) standards, and ensures names match across documents.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">Can a driver go online without verification?</h4>
            <p className="text-neutral-400 leading-relaxed">
              No. Both the client store and Firestore security rules block a driver from going online unless their verification status is explicitly set to VERIFIED by the administrative verification center.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">How does GPS Fraud Detection work?</h4>
            <p className="text-neutral-400 leading-relaxed">
              During an active ride, breadcrumb GPS points are collected. Upon completion, our auditing algorithm calculates total travelled distance, checks for impossible speeds (&gt;120 km/h or &gt;80 km/h for bikes/autos), coordinates jumps (&gt;500m in under 3s), and route deviation, flagging anomalous trips for neutral admin review.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
