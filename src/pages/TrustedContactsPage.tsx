import React, { useState, useEffect } from 'react';
import { useAppStore } from '../lib/store';
import { TrustedContact } from '../types';
import {
  ShieldCheck,
  Phone,
  Heart,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Radio,
  Lock,
  Share2,
} from 'lucide-react';

export const TrustedContactsPage: React.FC = () => {
  const { user, saveSafetySettings, removeTrustedContact } = useAppStore();

  const [primaryName, setPrimaryName] = useState(user?.trustedContact?.name || '');
  const [primaryPhone, setPrimaryPhone] = useState(user?.trustedContact?.phone || '');
  const [primaryRelation, setPrimaryRelation] = useState(user?.trustedContact?.relationship || 'Parent');

  const [showSecondary, setShowSecondary] = useState(Boolean(user?.secondaryContact));
  const [secondaryName, setSecondaryName] = useState(user?.secondaryContact?.name || '');
  const [secondaryPhone, setSecondaryPhone] = useState(user?.secondaryContact?.phone || '');
  const [secondaryRelation, setSecondaryRelation] = useState(user?.secondaryContact?.relationship || 'Friend');

  const [liveSharingEnabled, setLiveSharingEnabled] = useState(
    user?.liveSharingEnabled !== undefined ? user.liveSharingEnabled : true
  );
  const [consentGiven, setConsentGiven] = useState(
    user?.emergencyConsentGiven !== undefined ? user.emergencyConsentGiven : true
  );

  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.trustedContact) {
        setPrimaryName(user.trustedContact.name);
        setPrimaryPhone(user.trustedContact.phone);
        setPrimaryRelation(user.trustedContact.relationship);
      }
      if (user.secondaryContact) {
        setShowSecondary(true);
        setSecondaryName(user.secondaryContact.name);
        setSecondaryPhone(user.secondaryContact.phone);
        setSecondaryRelation(user.secondaryContact.relationship);
      }
      if (user.liveSharingEnabled !== undefined) {
        setLiveSharingEnabled(user.liveSharingEnabled);
      }
      if (user.emergencyConsentGiven !== undefined) {
        setConsentGiven(user.emergencyConsentGiven);
      }
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!primaryName.trim() || !primaryPhone.trim()) {
      setError('Please provide a name and mobile phone number for your primary emergency contact.');
      return;
    }

    if (liveSharingEnabled && !consentGiven) {
      setError('Please grant consent for live location sharing and emergency notifications.');
      return;
    }

    const primary: TrustedContact = {
      name: primaryName.trim(),
      phone: primaryPhone.trim(),
      relationship: primaryRelation,
      isPrimary: true,
    };

    let secondary: TrustedContact | undefined;
    if (showSecondary && secondaryName.trim() && secondaryPhone.trim()) {
      secondary = {
        name: secondaryName.trim(),
        phone: secondaryPhone.trim(),
        relationship: secondaryRelation,
        isPrimary: false,
      };
    }

    await saveSafetySettings({
      primaryContact: primary,
      secondaryContact: secondary,
      liveSharingEnabled,
      consentGiven,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRemovePrimary = async () => {
    if (window.confirm('Are you sure you want to remove your primary emergency contact?')) {
      await removeTrustedContact(false);
      setPrimaryName('');
      setPrimaryPhone('');
    }
  };

  const handleRemoveSecondary = async () => {
    await removeTrustedContact(true);
    setShowSecondary(false);
    setSecondaryName('');
    setSecondaryPhone('');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">🛡️ Emergency Contacts & Privacy</h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage verified emergency recipients, live location sharing permissions, and instant distress dispatch.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saved && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Safety settings and emergency contacts successfully updated!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6">
          {/* Primary Contact */}
          <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                <span className="font-semibold text-amber-400 text-xs uppercase tracking-wider">
                  Primary Emergency Contact (Required)
                </span>
              </div>
              {user?.trustedContact && (
                <button
                  type="button"
                  onClick={handleRemovePrimary}
                  className="text-neutral-500 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Contact</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-neutral-300 text-xs font-medium mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Ramesh Deshmukh"
                value={primaryName}
                onChange={(e) => setPrimaryName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 text-xs font-medium mb-1">
                  Mobile / WhatsApp Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98220 12345"
                  value={primaryPhone}
                  onChange={(e) => setPrimaryPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 text-xs font-medium mb-1">Relationship</label>
                <select
                  value={primaryRelation}
                  onChange={(e) => setPrimaryRelation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="Parent">Parent (Father / Mother)</option>
                  <option value="Spouse">Spouse / Partner</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Friend">Friend / Colleague</option>
                  <option value="Guardian">Guardian</option>
                </select>
              </div>
            </div>
          </div>

          {/* Optional Second Contact */}
          {showSecondary ? (
            <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4 relative">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-300 text-xs uppercase tracking-wider">
                  Optional Second Emergency Contact
                </span>
                <button
                  type="button"
                  onClick={handleRemoveSecondary}
                  className="text-neutral-500 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Second Contact</span>
                </button>
              </div>

              <div>
                <label className="block text-neutral-300 text-xs font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={secondaryName}
                  onChange={(e) => setSecondaryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 text-xs font-medium mb-1">
                    Mobile / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 91234 56789"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 text-xs font-medium mb-1">Relationship</label>
                  <select
                    value={secondaryRelation}
                    onChange={(e) => setSecondaryRelation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="Friend">Friend</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Colleague">Colleague</option>
                    <option value="Relative">Relative</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecondary(true)}
              className="w-full py-3 px-4 rounded-2xl bg-neutral-950 border border-dashed border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center gap-2 text-xs transition-colors"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Add Optional Second Emergency Contact</span>
            </button>
          )}

          {/* Live Location Sharing & Consent */}
          <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white text-xs">Live Location Sharing</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Generate secure real-time tracking link whenever a ride starts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLiveSharingEnabled(!liveSharingEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  liveSharingEnabled ? 'bg-amber-500' : 'bg-neutral-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-neutral-950 transition-transform ${
                    liveSharingEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="pt-3 border-t border-neutral-800/80">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-700 text-amber-500 focus:ring-amber-500 bg-neutral-900"
                />
                <span className="text-[11px] text-neutral-300 leading-relaxed">
                  I grant consent for ĀroHana to share my live GPS coordinates and send automated emergency alerts via WhatsApp/SMS to my emergency contacts during active journeys and SOS events.
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
          >
            Save Emergency Contact Settings
          </button>
        </form>

        <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 space-y-2">
          <h4 className="font-semibold text-white flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>How Emergency Protection Operates in ĀroHana:</span>
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>When your journey starts, a secure encrypted link is created allowing your trusted contact to monitor your route without logging in.</li>
            <li>In case of emergency SOS, high-accuracy GPS coordinates are captured immediately and transmitted to Safety Center & your contacts.</li>
            <li>Tracking automatically ceases as soon as the ride concludes or is cancelled.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
