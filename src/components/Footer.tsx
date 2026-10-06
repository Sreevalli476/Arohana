import React from 'react';
import { ShieldCheck, PhoneCall, Radio, Compass, Lock, Eye } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-950 border-t border-neutral-900 text-neutral-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-neutral-950 font-black">
                <Compass className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="text-base font-bold text-white font-mono">ĀroHana</span>
            </div>
            <p className="text-neutral-400 leading-relaxed">
              India's fair, transparent, and verified ride-hailing network. No hidden surge multiples, no unverified drivers.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-amber-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Strict 25% Surge Cap Guaranteed</span>
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">Safety Framework</h4>
            <ul className="space-y-2 text-neutral-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Client-Side OCR DL & RC Verification</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Automated GPS Fraud & Deviation Detection</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>2-Second Hold Instant SOS to Safety Center</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>200m Pickup Geofence for Ride Start</span>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">Live Journey Privacy</h4>
            <p className="text-neutral-400 leading-relaxed">
              Trusted contact live tracking uses 32-byte cryptographically secure tokens. No phone numbers, email addresses, or payment data are exposed to external viewers.
            </p>
            <div className="flex items-center gap-2 text-neutral-300">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>SHA-256 Hashed Tokens</span>
            </div>
          </div>

          {/* Col 4 */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">Emergency & Support</h4>
            <p className="text-neutral-400">
              Direct emergency helpline link for India National Emergency Services:
            </p>
            <a
              href="tel:112"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium transition-colors"
            >
              <PhoneCall className="w-4 h-4 text-rose-400" />
              <span>Tap to Call Emergency (112)</span>
            </a>
            <p className="text-[10px] text-neutral-500">
              In-app SOS alerts broadcast live GPS to the Safety Operations Center.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-neutral-500">
          <p>© {new Date().getFullYear()} ĀroHana Mobility Technologies. All rights reserved.</p>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>Fair Rides</span>
            <span>·</span>
            <span>Trusted Drivers</span>
            <span>·</span>
            <span>Safer Journeys</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
