import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { UserRole, VehicleType } from '../types';
import {
  Compass,
  User,
  Car,
  Shield,
  Lock,
  Mail,
  Phone,
  ArrowRight,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, signupRider, signupDriver } = useAppStore();

  const [mode, setMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  );
  const [signupRole, setSignupRole] = useState<'rider' | 'driver'>('rider');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Rider specific
  const [trustedName, setTrustedName] = useState('');
  const [trustedPhone, setTrustedPhone] = useState('');
  const [trustedRelation, setTrustedRelation] = useState('Parent');

  // Driver specific
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || 'Login failed. Check your credentials.');
          setLoading(false);
          return;
        }
        // Redirect based on current store user
        const u = useAppStore.getState().user;
        if (u?.role === 'admin') navigate('/admin');
        else if (u?.role === 'driver') navigate('/driver');
        else navigate('/book');
      } else {
        if (signupRole === 'rider') {
          const res = await signupRider({
            email,
            pass: password,
            name,
            phone,
            trustedContact: trustedName
              ? { name: trustedName, phone: trustedPhone, relationship: trustedRelation }
              : undefined,
          });
          if (!res.success) {
            setError(res.error || 'Signup failed');
            setLoading(false);
            return;
          }
          navigate('/book');
        } else {
          const res = await signupDriver({
            email,
            pass: password,
            name,
            phone,
            vehicleType,
            vehicleNumber,
            vehicleModel,
          });
          if (!res.success) {
            setError(res.error || 'Driver registration failed');
            setLoading(false);
            return;
          }
          navigate('/driver');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const setDemoLogin = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setMode('login');
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-neutral-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-amber-500 items-center justify-center text-neutral-950 font-black mb-3 shadow-lg shadow-amber-500/20">
          <Compass className="w-7 h-7 stroke-[2.5]" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white font-mono">ĀroHana</h2>
        <p className="text-xs text-neutral-400 mt-1">
          {mode === 'login' ? 'Welcome back to fair mobility' : 'Create your verified account'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Mode Switcher */}
          <div className="flex p-1 bg-neutral-950 rounded-xl mb-6 border border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'login' ? 'bg-amber-500 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'signup' ? 'bg-amber-500 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* If signup, choose role */}
          {mode === 'signup' && (
            <div className="flex gap-3 mb-6">
              <button
                type="button"
                onClick={() => setSignupRole('rider')}
                className={`flex-1 p-3 rounded-2xl border text-center transition-all ${
                  signupRole === 'rider'
                    ? 'border-amber-500 bg-amber-500/10 text-white font-bold'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <User className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                <span className="text-xs">Rider</span>
              </button>
              <button
                type="button"
                onClick={() => setSignupRole('driver')}
                className={`flex-1 p-3 rounded-2xl border text-center transition-all ${
                  signupRole === 'driver'
                    ? 'border-amber-500 bg-amber-500/10 text-white font-bold'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <Car className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                <span className="text-xs">Driver Partner</span>
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Mobile Phone (India)</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-neutral-300 font-medium mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Rider trusted contact */}
            {mode === 'signup' && signupRole === 'rider' && (
              <div className="pt-2 border-t border-neutral-800 space-y-3">
                <p className="text-[11px] font-semibold text-amber-400">
                  Trusted Emergency Contact (Optional)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={trustedName}
                    onChange={(e) => setTrustedName(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="tel"
                    placeholder="Contact Phone"
                    value={trustedPhone}
                    onChange={(e) => setTrustedPhone(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Driver vehicle details */}
            {mode === 'signup' && signupRole === 'driver' && (
              <div className="pt-2 border-t border-neutral-800 space-y-3">
                <p className="text-[11px] font-semibold text-amber-400">Vehicle Specifications</p>

                <div>
                  <label className="block text-neutral-400 mb-1">Vehicle Category</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="bike">Moto (Two-wheeler)</option>
                    <option value="auto">Auto (Three-wheeler)</option>
                    <option value="sedan">Sedan (AC 4-seater)</option>
                    <option value="suv">SUV (AC 6-seater)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Registration (e.g. DL01AB1234)"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    className="px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 uppercase font-mono"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Model (e.g. Honda City)"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Complete Registration'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins Footer */}
          <div className="mt-6 pt-6 border-t border-neutral-800">
            <p className="text-[11px] text-neutral-400 text-center mb-2.5">
              Fill Demo Credentials (1-click):
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDemoLogin('rider@arohana.in', 'Rider@123')}
                className="py-1.5 px-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-medium"
              >
                Rider
              </button>
              <button
                type="button"
                onClick={() => setDemoLogin('driver@arohana.in', 'Driver@123')}
                className="py-1.5 px-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-medium"
              >
                Driver
              </button>
              <button
                type="button"
                onClick={() => setDemoLogin('admin@arohana.in', 'Admin@123')}
                className="py-1.5 px-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-medium"
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
