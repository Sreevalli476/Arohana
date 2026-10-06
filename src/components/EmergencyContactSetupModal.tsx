import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import { TrustedContact } from '../types';
import {
  ShieldCheck,
  User,
  Phone,
  Heart,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Share2,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface EmergencyContactSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInitialSetup?: boolean;
}

export const EmergencyContactSetupModal: React.FC<EmergencyContactSetupModalProps> = ({
  isOpen,
  onClose,
  isInitialSetup = false,
}) => {
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
    user?.emergencyConsentGiven !== undefined ? user.emergencyConsentGiven : false
  );

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!primaryName.trim() || !primaryPhone.trim()) {
      setError('Please provide a name and mobile phone number for your primary emergency contact.');
      return;
    }

    if (liveSharingEnabled && !consentGiven) {
      setError('Please confirm your consent for location sharing and emergency notifications.');
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

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1200);
  };

  const handleRemoveSecondary = async () => {
    await removeTrustedContact(true);
    setShowSecondary(false);
    setSecondaryName('');
    setSecondaryPhone('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-neutral-100 my-8">
        {!isInitialSetup && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>🛡️ Set Up Emergency Contact</span>
            </h3>
            <p className="text-xs text-neutral-400">
              {isInitialSetup
                ? 'Required for rider safety & live trip notifications'
                : 'Manage your verified emergency contacts & privacy'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Emergency Contacts Configured!</h4>
            <p className="text-xs text-neutral-400">Your safety settings have been securely updated.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {/* Primary Contact */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-400 text-[11px] uppercase tracking-wider">
                  Primary Emergency Contact (Required)
                </span>
                <span className="text-[10px] text-neutral-500">First responder</span>
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ramesh Deshmukh"
                  value={primaryName}
                  onChange={(e) => setPrimaryName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-300 mb-1">Mobile / WhatsApp Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98220 12345"
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 mb-1">Relationship</label>
                  <select
                    value={primaryRelation}
                    onChange={(e) => setPrimaryRelation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
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
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-300 text-[11px] uppercase tracking-wider">
                    Optional Second Emergency Contact
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveSecondary}
                    className="text-neutral-400 hover:text-rose-400 flex items-center gap-1 text-[11px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                <div>
                  <label className="block text-neutral-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Priya Sharma"
                    value={secondaryName}
                    onChange={(e) => setSecondaryName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-neutral-300 mb-1">Mobile / WhatsApp Number</label>
                    <input
                      type="tel"
                      placeholder="+91 91234 56789"
                      value={secondaryPhone}
                      onChange={(e) => setSecondaryPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-300 mb-1">Relationship</label>
                    <select
                      value={secondaryRelation}
                      onChange={(e) => setSecondaryRelation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
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
                className="w-full py-2.5 px-3 rounded-2xl bg-neutral-950 border border-dashed border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Optional Second Emergency Contact</span>
              </button>
            )}

            {/* Live Location Sharing & Notifications Toggle */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Live Location Sharing</p>
                  <p className="text-[11px] text-neutral-400">
                    Automatically generate encrypted tracking link when ride starts
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

              {/* Explicit User Consent Checkbox */}
              <div className="pt-2 border-t border-neutral-800/80">
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

            <div className="flex gap-2 pt-1">
              {!isInitialSetup && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition-all shadow-lg shadow-amber-500/20"
              >
                Save Emergency Contacts
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
