import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { isMapboxConfigured } from '../lib/mapbox';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  Compass,
  Shield,
  Car,
  User,
  LogOut,
  AlertTriangle,
  Menu,
  X,
  Radio,
  CheckCircle,
  FileCheck,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, driverState, activeRideId } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const hasMapbox = isMapboxConfigured();
  const hasFirebase = isFirebaseConfigured();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Compass className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white font-mono">ĀroHana</span>
              <span className="text-[10px] tracking-wider uppercase font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                Fair Mobility
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 hidden sm:block">
              Fair Rides · Trusted Drivers · Safer Journeys
            </p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-300">
          <Link
            to="/book"
            className={`transition-colors hover:text-amber-400 ${
              location.pathname === '/book' ? 'text-amber-400' : ''
            }`}
          >
            Book Ride
          </Link>
          <Link
            to="/driver"
            className={`transition-colors hover:text-amber-400 ${
              location.pathname === '/driver' ? 'text-amber-400' : ''
            }`}
          >
            Driver Console
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`transition-colors hover:text-amber-400 ${
                location.pathname === '/admin' ? 'text-amber-400' : ''
              }`}
            >
              Admin Center
            </Link>
          )}
          {user?.role === 'rider' && (
            <Link
              to="/contacts"
              className={`transition-colors hover:text-amber-400 ${
                location.pathname === '/contacts' ? 'text-amber-400' : ''
              }`}
            >
              Trusted Contacts
            </Link>
          )}
        </nav>

        {/* User Controls & Status */}
        <div className="hidden md:flex items-center gap-3">
          {/* Driver Status Chip */}
          {user?.role === 'driver' && driverState && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs">
              <Radio
                className={`w-3.5 h-3.5 ${
                  driverState.isOnline ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'
                }`}
              />
              <span className={driverState.isOnline ? 'text-emerald-400 font-medium' : 'text-neutral-400'}>
                {driverState.isOnline ? 'Online' : 'Offline'}
              </span>
              <span className="text-neutral-600">·</span>
              <span
                className={`font-semibold ${
                  driverState.verificationStatus === 'VERIFIED'
                    ? 'text-emerald-400'
                    : driverState.verificationStatus === 'UNDER_REVIEW'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {driverState.verificationStatus}
              </span>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-semibold text-white leading-tight">{user.name}</p>
                <p className="text-[11px] text-neutral-400 capitalize">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors border border-neutral-800"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth?mode=login"
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-200 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/auth?mode=signup"
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-2">
          {user?.role === 'driver' && driverState?.isOnline && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-neutral-950 border-b border-neutral-800 px-4 pt-3 pb-5 space-y-3">
          <Link
            to="/book"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-neutral-200 hover:text-amber-400"
          >
            Book a Ride
          </Link>
          <Link
            to="/driver"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-neutral-200 hover:text-amber-400"
          >
            Driver Console
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-neutral-200 hover:text-amber-400"
            >
              Admin Dashboard
            </Link>
          )}
          {user?.role === 'rider' && (
            <Link
              to="/contacts"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-neutral-200 hover:text-amber-400"
            >
              Trusted Contacts
            </Link>
          )}
          <Link
            to="/history"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-neutral-200 hover:text-amber-400"
          >
            Ride History
          </Link>

          <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
            {user ? (
              <>
                <div>
                  <p className="text-xs font-semibold text-white">{user.name}</p>
                  <p className="text-[11px] text-neutral-400 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="px-3 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-neutral-300"
                >
                  Log Out
                </button>
              </>
            ) : (
              <div className="flex gap-2 w-full">
                <Link
                  to="/auth?mode=login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 text-xs font-semibold rounded bg-neutral-900 border border-neutral-800 text-white"
                >
                  Log In
                </Link>
                <Link
                  to="/auth?mode=signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 text-xs font-semibold rounded bg-amber-500 text-neutral-950 font-bold"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
