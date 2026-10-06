import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import {
  Flame,
  Radio,
  RotateCcw,
  Sparkles,
  Zap,
  ChevronUp,
  ChevronDown,
  Navigation,
  CheckCircle,
  Clock,
  PhoneCall,
} from 'lucide-react';

export const DemoControls: React.FC = () => {
  const {
    demoMode,
    pcDemoCallMode,
    togglePcDemoCallMode,
    isPeakDemandSimulated,
    togglePeakDemand,
    simulateGpsAnomaly,
    toggleSimulateGpsAnomaly,
    simulateDriverMovement,
    toggleSimulateDriverMovement,
    resetDemoRide,
    activeRideId,
    rides,
    completePayment,
    fastForwardScheduledRide,
  } = useAppStore();

  const [expanded, setExpanded] = useState<boolean>(true);

  if (!demoMode) return null;

  const currentRide = activeRideId ? rides[activeRideId] : null;
  const scheduledRidesList = Object.values(rides).filter(
    (r) => r.bookingType === 'PREBOOKED' && r.status === 'SCHEDULED'
  );

  return (
    <div className="fixed bottom-3 right-3 z-30 flex flex-col items-end">
      {/* Header bar */}
      <div className="bg-neutral-900/95 border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden max-w-sm">
        <div
          onClick={() => setExpanded(!expanded)}
          className="px-3.5 py-2 flex items-center justify-between gap-3 cursor-pointer bg-neutral-950/60 hover:bg-neutral-950 text-xs border-b border-neutral-800 select-none"
        >
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950 text-[10px] font-black uppercase tracking-wider">
              DEMO
            </span>
            <span className="font-semibold text-neutral-200">Simulation Toolbar</span>
          </div>
          <button className="text-neutral-400 hover:text-white">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="p-3 space-y-2 text-xs">
            {/* Simulate Peak Demand */}
            <button
              onClick={togglePeakDemand}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                isPeakDemandSimulated
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="px-1 py-0.2 rounded bg-amber-500 text-neutral-950 text-[9px] font-bold">
                  DEMO
                </span>
                <Flame className={`w-3.5 h-3.5 ${isPeakDemandSimulated ? 'text-amber-400 fill-amber-400' : 'text-neutral-400'}`} />
                <span>Simulate Peak Demand</span>
              </div>
              <span className={`text-[11px] ${isPeakDemandSimulated ? 'text-amber-400' : 'text-neutral-500'}`}>
                {isPeakDemandSimulated ? 'ON (+Surge)' : 'OFF'}
              </span>
            </button>

            {/* Simulate GPS Anomaly */}
            <button
              onClick={toggleSimulateGpsAnomaly}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                simulateGpsAnomaly
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-semibold'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="px-1 py-0.2 rounded bg-amber-500 text-neutral-950 text-[9px] font-bold">
                  DEMO
                </span>
                <Zap className={`w-3.5 h-3.5 ${simulateGpsAnomaly ? 'text-rose-400' : 'text-neutral-400'}`} />
                <span>Simulate GPS Anomaly</span>
              </div>
              <span className={`text-[11px] ${simulateGpsAnomaly ? 'text-rose-400' : 'text-neutral-500'}`}>
                {simulateGpsAnomaly ? 'ON (Jumps/Speed)' : 'OFF'}
              </span>
            </button>

            {/* Simulate Driver Movement (OFF by default) */}
            <button
              onClick={toggleSimulateDriverMovement}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                simulateDriverMovement
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="px-1 py-0.2 rounded bg-amber-500 text-neutral-950 text-[9px] font-bold">
                  DEMO
                </span>
                <Navigation className={`w-3.5 h-3.5 ${simulateDriverMovement ? 'text-emerald-400 animate-spin' : 'text-neutral-400'}`} />
                <span>Simulate Driver Movement</span>
              </div>
              <span className={`text-[11px] ${simulateDriverMovement ? 'text-emerald-400' : 'text-neutral-500'}`}>
                {simulateDriverMovement ? 'ON (Moving)' : 'OFF'}
              </span>
            </button>

            {/* PC Demo Call Mode (No tel: prompt on Windows) */}
            <button
              onClick={togglePcDemoCallMode}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                pcDemoCallMode
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="px-1 py-0.2 rounded bg-amber-500 text-neutral-950 text-[9px] font-bold">
                  DEMO
                </span>
                <PhoneCall className={`w-3.5 h-3.5 ${pcDemoCallMode ? 'text-emerald-400' : 'text-neutral-400'}`} />
                <span>PC Call Mode</span>
              </div>
              <span className={`text-[11px] ${pcDemoCallMode ? 'text-emerald-400' : 'text-neutral-500'}`}>
                {pcDemoCallMode ? 'ON (No tel:)' : 'OFF'}
              </span>
            </button>

            {/* Fast-forward scheduled time (Yellow DEMO ONLY button) */}
            {scheduledRidesList.length > 0 && (
              <button
                onClick={() => fastForwardScheduledRide(scheduledRidesList[0].id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500 hover:bg-amber-500/30 text-amber-300 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950 text-[9px] font-black uppercase">
                    DEMO ONLY
                  </span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold">Fast-forward scheduled time</span>
                </div>
                <span className="text-[10px] text-amber-400 font-mono">now + 5m</span>
              </button>
            )}

            {/* Quick action: Simulate Payment Success if active ride is in RIDE_COMPLETED */}
            {currentRide && (currentRide.status === 'RIDE_COMPLETED' || currentRide.status === 'RIDE_STARTED') && (
              <button
                onClick={() => completePayment(currentRide.id, 'upi')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-950 border border-emerald-800 hover:border-emerald-600 text-emerald-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1 py-0.2 rounded bg-amber-500 text-neutral-950 text-[9px] font-bold">
                    DEMO
                  </span>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Simulate Payment Success</span>
                </div>
                <span className="text-[10px] text-neutral-400">₹{currentRide.finalFare}</span>
              </button>
            )}

            {/* Reset Demo Ride */}
            <button
              onClick={resetDemoRide}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              <span className="px-1 py-0.2 rounded bg-amber-500 text-neutral-950 text-[9px] font-bold">
                DEMO
              </span>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Ride</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
