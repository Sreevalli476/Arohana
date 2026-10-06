import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './lib/store';
import { promoteDueScheduledRides } from './lib/prebooking';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { DemoControls } from './components/DemoControls';
import { EmergencyContactSetupModal } from './components/EmergencyContactSetupModal';
import { LandingPage } from './pages/LandingPage';
import { RiderBookingPage } from './pages/RiderBookingPage';
import { DriverDashboardPage } from './pages/DriverDashboardPage';
import { DriverVerificationPage } from './pages/DriverVerificationPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { PublicTrackingPage } from './pages/PublicTrackingPage';
import { AuthPage } from './pages/AuthPage';
import { RiderHistoryPage } from './pages/RiderHistoryPage';
import { TrustedContactsPage } from './pages/TrustedContactsPage';

export default function App() {
  const {
    user,
    showSafetyModal,
    setShowSafetyModal,
    rides,
    promoteScheduledRide,
    markNoDriverFound,
    activationWindowMinutes,
    addNotification,
  } = useAppStore();

  // First-time rider check: Show "🛡️ Set Up Emergency Contact"
  useEffect(() => {
    if (user && user.role === 'rider' && !user.hasCompletedSafetySetup && !user.trustedContact) {
      setShowSafetyModal(true);
    }
  }, [user, setShowSafetyModal]);

  // Shared promoteDueScheduledRides() runs once at app load and every 30s while any signed-in app is open
  useEffect(() => {
    const checkScheduled = async () => {
      await promoteDueScheduledRides({
        rides,
        activationWindowMinutes,
        onPromoteRide: async (rideId) => {
          await promoteScheduledRide(rideId);
        },
        onMarkNoDriverFound: async (rideId) => {
          await markNoDriverFound(rideId);
        },
      });

      // Approaching notifications check for rider (60 mins and 15 mins before)
      const now = Date.now();
      for (const ride of Object.values(rides)) {
        if (ride.bookingType === 'PREBOOKED' && ride.status === 'SCHEDULED' && ride.scheduledAt) {
          const diffMs = new Date(ride.scheduledAt).getTime() - now;
          const diffMins = Math.floor(diffMs / 60000);

          if (diffMins === 60) {
            addNotification({
              title: 'Scheduled Ride in 1 Hour',
              message: `Your ride to ${ride.destination.name || ride.destination.address} is scheduled in 1 hour.`,
              type: 'info',
            });
          }
          if (diffMins === 15) {
            addNotification({
              title: 'Scheduled Ride in 15 Minutes',
              message: `Your ride to ${ride.destination.name || ride.destination.address} will start searching for drivers soon.`,
              type: 'info',
            });
          }
        }
      }
    };

    checkScheduled();
    const timer = setInterval(checkScheduled, 30000);
    return () => clearInterval(timer);
  }, [rides, activationWindowMinutes, promoteScheduledRide, markNoDriverFound, addNotification]);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500 selection:text-neutral-950">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/book" element={<RiderBookingPage />} />
            <Route path="/driver" element={<DriverDashboardPage />} />
            <Route path="/driver/verify" element={<DriverVerificationPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/track/:token" element={<PublicTrackingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/history" element={<RiderHistoryPage />} />
            <Route path="/contacts" element={<TrustedContactsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        <DemoControls />

        {/* Global First-Time & On-Demand Emergency Contact Setup Modal */}
        <EmergencyContactSetupModal
          isOpen={showSafetyModal}
          onClose={() => setShowSafetyModal(false)}
          isInitialSetup={Boolean(user && user.role === 'rider' && !user.hasCompletedSafetySetup)}
        />
      </div>
    </BrowserRouter>
  );
}
