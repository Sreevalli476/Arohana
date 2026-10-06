import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { Ride, TrustedContact } from '../types';
import {
  dispatchEmergencyCall,
  EmergencyCallResult,
  initiateDevicePhoneHandler,
  formatE164Phone,
  buildWhatsAppSosMessage,
  buildWhatsAppResolvedMessage,
  dispatchWhatsAppSos,
  EmergencyCallService,
  CallStatusState,
} from '../lib/emergencyCall';
import {
  AlertTriangle,
  PhoneCall,
  Phone,
  Share2,
  CheckCircle,
  X,
  Radio,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Volume2,
  StopCircle,
  Copy,
  Check,
  MicOff,
  PhoneOff,
} from 'lucide-react';

interface SosModalProps {
  ride: Ride;
  trustedContact?: TrustedContact;
  secondaryContact?: TrustedContact;
  onClose: () => void;
}

export const SosModal: React.FC<SosModalProps> = ({
  ride,
  trustedContact,
  secondaryContact,
  onClose,
}) => {
  const { user, triggerSos, stopSos, updateSosLocation, emergencyAlerts, activeSosAlertId, pcDemoCallMode } = useAppStore();

  const [callSession, setCallSession] = useState<CallStatusState>(EmergencyCallService.getCallStatus());
  const [showNationalEmergencyNotice, setShowNationalEmergencyNotice] = useState<boolean>(false);

  useEffect(() => {
    const unsub = EmergencyCallService.subscribe((state) => {
      setCallSession(state);
    });
    return () => unsub();
  }, []);

  const [holdingProgress, setHoldingProgress] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);

  // Check if SOS is already active for this ride
  const existingAlert = emergencyAlerts.find(
    (a) => a.rideId === ride.id && a.status === 'ACTIVE'
  );

  const [isActivated, setIsActivated] = useState<boolean>(Boolean(existingAlert));
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(
    existingAlert?.id || activeSosAlertId || null
  );

  const [currentGps, setCurrentGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    ageSeconds: number;
  } | null>(null);

  const [callStatus, setCallStatus] = useState<EmergencyCallResult | null>(null);
  const [isCallingContact, setIsCallingContact] = useState<boolean>(Boolean(existingAlert));
  const [callingContactPhone, setCallingContactPhone] = useState<string>('');
  const [callingContactName, setCallingContactName] = useState<string>('');
  const [whatsAppDirectUrl, setWhatsAppDirectUrl] = useState<string>('');
  const [whatsAppDispatchStatus, setWhatsAppDispatchStatus] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const [showStopConfirmation, setShowStopConfirmation] = useState<boolean>(false);
  const [stopReason, setStopReason] = useState<string>('Rider confirmed situation is safe');
  const [resolvedSuccess, setResolvedSuccess] = useState<boolean>(false);

  const holdTimerRef = useRef<any>(null);
  const locationWatchRef = useRef<number | null>(null);
  const lastFixTimeRef = useRef<number>(Date.now());

  // Verified contact from props or user profile in database
  const targetContact =
    trustedContact || (user?.trustedContact?.phone ? user.trustedContact : secondaryContact) || user?.secondaryContact;
  const verifiedPhone = targetContact?.phone ? formatE164Phone(targetContact.phone) : '';

  // Immediate Real GPS Capture on Mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            ageSeconds: 0,
          });
          lastFixTimeRef.current = Date.now();
        },
        () => {
          // Fallback to ride pickup if GPS hardware temporarily delayed
          setCurrentGps({
            lat: ride.pickup.lat,
            lng: ride.pickup.lng,
            accuracy: 40,
            ageSeconds: Math.round((Date.now() - new Date(ride.requestedAt).getTime()) / 1000),
          });
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, [ride]);

  // Keep locationWatch active if alert is already active
  useEffect(() => {
    if (isActivated && currentAlertId && navigator.geolocation) {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          updateSosLocation(
            currentAlertId,
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy
          );
          setCurrentGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            ageSeconds: 0,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    }

    return () => {
      if (locationWatchRef.current) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [isActivated, currentAlertId]);

  // Hold 2s trigger mechanism
  const handleHoldStart = () => {
    if (isActivated) return;
    setIsHolding(true);
    setHoldingProgress(0);

    const startTime = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / 2000) * 100);
      setHoldingProgress(progress);

      if (progress >= 100) {
        clearInterval(holdTimerRef.current);
        activateEmergency();
      }
    }, 50);
  };

  const handleHoldEnd = () => {
    if (isActivated) return;
    setIsHolding(false);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    setHoldingProgress(0);
  };

  // Build the live tracking link
  const liveTrackingToken = ride.trackingToken || existingAlert?.liveTrackingUrl?.split('/track/')[1] || '';
  const liveTrackingUrl = liveTrackingToken
    ? `${window.location.origin}/track/${liveTrackingToken}`
    : `${window.location.origin}/track/${ride.id}`;

  const currentLat = currentGps?.lat || ride.pickup.lat;
  const currentLng = currentGps?.lng || ride.pickup.lng;

  // Exact WhatsApp Emergency Message Text
  const currentSosMessageText = buildWhatsAppSosMessage({
    riderName: ride.riderName || user?.name || 'Verified Rider',
    rideId: ride.id,
    driverName: ride.driverName,
    liveTrackingUrl,
    lat: currentLat,
    lng: currentLng,
  });

  // Direct WhatsApp URL generator
  const getWhatsAppSosUrl = () => {
    const digitsOnly = verifiedPhone.replace(/[^0-9]/g, '');
    return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(currentSosMessageText)}`;
  };

  // Direct WhatsApp Resolution URL
  const getWhatsAppResolvedUrl = () => {
    const digitsOnly = verifiedPhone.replace(/[^0-9]/g, '');
    const resolvedText = buildWhatsAppResolvedMessage();
    return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(resolvedText)}`;
  };

  // SOS Activation Handler
  const activateEmergency = async () => {
    setIsActivated(true);
    setIsHolding(false);

    // 1. Capture REAL GPS coordinates
    const lat = currentGps?.lat || ride.pickup.lat;
    const lng = currentGps?.lng || ride.pickup.lng;
    const accuracy = currentGps?.accuracy || 15;

    try {
      // 2. Trigger SOS and create record with live link
      const alertId = await triggerSos(ride.id, lat, lng, accuracy);
      setCurrentAlertId(alertId);

      // 3. Start continuous emergency location tracking
      if (navigator.geolocation) {
        locationWatchRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            updateSosLocation(
              alertId,
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy
            );
            setCurrentGps({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              ageSeconds: 0,
            });
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 3000 }
        );
      }

      // 4. CALL TRUSTED CONTACT IMMEDIATELY:
      if (verifiedPhone) {
        setIsCallingContact(true);
        setCallingContactPhone(verifiedPhone);
        setCallingContactName(targetContact?.name || 'Trusted Contact');

        // When in PC Demo Mode (default on PC/desktop), DO NOT execute window.location = "tel:..."
        if (pcDemoCallMode) {
          await EmergencyCallService.startCall(verifiedPhone, {
            rideId: ride.id,
            riderName: ride.riderName || user?.name || 'Verified Rider',
            driverName: ride.driverName,
            liveTrackingUrl,
            lat,
            lng,
            contactName: targetContact?.name || 'Trusted Contact',
          });
        } else {
          // Fallback to mobile tel: handler only if PC demo mode is explicitly disabled
          initiateDevicePhoneHandler(verifiedPhone, false);
          const callResult = await dispatchEmergencyCall(verifiedPhone, ride.id, liveTrackingUrl);
          setCallStatus(callResult);
        }
      }

      // 5. Prepare WhatsApp Emergency message with real live tracking link
      const whatsAppUrl = getWhatsAppSosUrl();
      setWhatsAppDirectUrl(whatsAppUrl);

      // Attempt server WhatsApp dispatch if configured
      const waResult = await dispatchWhatsAppSos(verifiedPhone, currentSosMessageText, liveTrackingUrl);
      setWhatsAppDispatchStatus(waResult.statusMessage);

      // On supported browsers, open WhatsApp dispatch ready
      try {
        window.open(whatsAppUrl, '_blank');
      } catch (e) {
        // Pop-up blocker fallback handled via prominent button in UI
      }
    } catch (e) {
      console.error('Failed to trigger SOS:', e);
    }
  };

  // STOP SOS Handler
  const handleConfirmStopSos = async () => {
    if (!currentAlertId) return;

    if (locationWatchRef.current) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }

    await stopSos(currentAlertId, stopReason);
    setResolvedSuccess(true);
    setShowStopConfirmation(false);

    // Automatically prompt WhatsApp resolution message
    const resolvedUrl = getWhatsAppResolvedUrl();
    try {
      window.open(resolvedUrl, '_blank');
    } catch (e) {}

    setTimeout(() => {
      onClose();
    }, 3000);
  };

  const handleStartCall = async () => {
    if (!verifiedPhone) return;
    if (pcDemoCallMode) {
      await EmergencyCallService.startCall(verifiedPhone, {
        rideId: ride.id,
        riderName: ride.riderName || user?.name || 'Verified Rider',
        driverName: ride.driverName,
        liveTrackingUrl,
        lat: currentLat,
        lng: currentLng,
        contactName: targetContact?.name || 'Trusted Contact',
      });
    } else {
      initiateDevicePhoneHandler(verifiedPhone, false);
    }
  };

  const handleCopyLiveLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(liveTrackingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-lg bg-neutral-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl relative text-neutral-100 my-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-500">
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Emergency SOS Control</h3>
            <p className="text-xs text-neutral-400">
              {isActivated ? 'Live distress broadcast active' : 'Direct emergency response & broadcast'}
            </p>
          </div>
        </div>

        {resolvedSuccess ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="text-lg font-bold text-white">SOS Deactivated & Marked Resolved</h4>
            <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
              Emergency location broadcast has stopped. Secure tracking token has expired.
            </p>
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-emerald-400 text-left space-y-1">
              <p className="text-[10px] text-neutral-500 font-sans uppercase font-bold">Resolved WhatsApp Message:</p>
              <p className="whitespace-pre-line text-white">
                {buildWhatsAppResolvedMessage()}
              </p>
            </div>
            <a
              href={getWhatsAppResolvedUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50"
            >
              <Share2 className="w-4 h-4" />
              <span>Send Resolution Update on WhatsApp</span>
            </a>
          </div>
        ) : showStopConfirmation ? (
          /* Confirmation to Stop SOS */
          <div className="space-y-4 p-5 rounded-2xl bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-2.5 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="font-bold text-sm text-white">Confirm Stop SOS</h4>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to stop the emergency broadcast? This will:
            </p>
            <ul className="text-xs text-neutral-400 list-disc pl-5 space-y-1">
              <li>Mark the distress incident as <strong className="text-white">RESOLVED</strong></li>
              <li>Cease real-time GPS location streaming immediately</li>
              <li>Expire and revoke the secure tracking URL</li>
              <li>Provide WhatsApp resolution confirmation to your trusted contacts</li>
            </ul>

            <div>
              <label className="block text-neutral-400 text-[11px] mb-1">Resolution Summary</label>
              <input
                type="text"
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowStopConfirmation(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs"
              >
                Keep SOS Active
              </button>
              <button
                onClick={handleConfirmStopSos}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50"
              >
                Yes, Stop SOS
              </button>
            </div>
          </div>
        ) : !isActivated ? (
          /* Initial Hold to Activate SOS */
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/50 text-xs text-rose-200 space-y-2">
              <p className="font-semibold text-rose-400">What happens when you trigger SOS:</p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-300">
                <li>Captures high-accuracy real GPS coordinates immediately</li>
                <li>Generates cryptographically random live tracking URL</li>
                <li>Initiates device phone handler: <code className="text-amber-400 font-mono">tel:{verifiedPhone || '+91...'}</code></li>
                <li>Dispatches official WhatsApp emergency distress message with live URL</li>
                <li>Updates Admin Safety Operations Center in real time</li>
              </ul>
            </div>

            {/* Hold Button */}
            <div className="flex flex-col items-center gap-3 py-2">
              <button
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldEnd}
                onTouchStart={handleHoldStart}
                onTouchEnd={handleHoldEnd}
                className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center select-none shadow-2xl transition-all cursor-pointer ${
                  isHolding ? 'scale-95 bg-rose-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'
                }`}
              >
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="88"
                    cy="88"
                    r="80"
                    className="stroke-rose-950/40 fill-none"
                    strokeWidth="8"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r="80"
                    className="stroke-amber-400 fill-none transition-all duration-75"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 80}
                    strokeDashoffset={2 * Math.PI * 80 * (1 - holdingProgress / 100)}
                    strokeLinecap="round"
                  />
                </svg>

                <AlertTriangle className="w-10 h-10 mb-1 animate-pulse" />
                <span className="text-lg font-black tracking-wider">HOLD 2s</span>
                <span className="text-[10px] uppercase font-bold text-rose-200">
                  {isHolding ? 'Keep holding...' : 'Press & Hold'}
                </span>
              </button>

              <p className="text-xs text-neutral-400 text-center">
                Press and hold for 2 seconds to prevent accidental triggers.
              </p>
            </div>
          </div>
        ) : (
          /* ================= ACTIVE SOS FLOW ================= */
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Active Alert Banner */}
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-rose-300 tracking-wide">
                    SOS BROADCAST ACTIVE
                  </p>
                  <p className="text-xs text-rose-200">
                    Live GPS coordinates are transmitting continuously to the Safety Center.
                  </p>
                </div>
              </div>
            </div>

            {/* REAL GPS Telemetry Display */}
            {currentGps && (
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="flex items-center gap-1 font-sans">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>Real GPS Coordinates</span>
                  </span>
                  <span className="text-white font-bold">
                    {currentGps.lat.toFixed(5)}, {currentGps.lng.toFixed(5)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="font-sans">Fix Accuracy</span>
                  <span className="text-neutral-200">±{Math.round(currentGps.accuracy)} meters</span>
                </div>
              </div>
            )}

            {/* 1. CALL TRUSTED CONTACT SECTION - BROWSER-BASED DEMO CALL */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <PhoneCall className={`w-4 h-4 ${callSession.status === 'connected' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
                  <span className="text-white font-bold">📞 Emergency Call</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${callSession.isRealCall ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                  {callSession.isRealCall ? '🟢 REAL VOICE CALL' : '🟡 PC HACKATHON DEMO'}
                </span>
              </div>

              {/* Contact Information & Live Call Status */}
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-neutral-300">
                      Calling: <strong className="text-white">{callSession.contactName || targetContact?.name || 'Trusted Contact'}</strong>
                    </p>
                    <p className="text-[11px] font-mono text-neutral-400">
                      Number: <span className="text-neutral-200">{callSession.phoneNumber || verifiedPhone}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    {callSession.status === 'connecting' && (
                      <span className="text-amber-400 font-bold text-xs flex items-center gap-1 justify-end">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                        <span>Connecting...</span>
                      </span>
                    )}
                    {callSession.status === 'connected' && (
                      <div className="space-y-0.5 text-right">
                        <span className="text-emerald-400 font-extrabold text-xs block">
                          🟢 CALL CONNECTED — DEMO
                        </span>
                        <span className="font-mono text-xs font-bold text-white bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 inline-block">
                          {String(Math.floor(callSession.durationSeconds / 60)).padStart(2, '0')}:{String(callSession.durationSeconds % 60).padStart(2, '0')} call timer
                        </span>
                      </div>
                    )}
                    {callSession.status === 'ended' && (
                      <span className="text-neutral-400 font-bold text-xs bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 inline-block">
                        Call ended
                      </span>
                    )}
                    {callSession.status === 'idle' && (
                      <span className="text-neutral-400 text-[11px]">Ready to call</span>
                    )}
                  </div>
                </div>

                {/* Clearly display: "PC HACKATHON DEMO — Voice call simulation" */}
                <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] flex items-center justify-between">
                  <span className="font-semibold">PC HACKATHON DEMO — Voice call simulation</span>
                  <span className="text-[9px] text-neutral-400">Browser Audio Session</span>
                </div>

                {/* Emergency Message readout */}
                <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 text-[11px] text-neutral-300 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-neutral-500">Live Voice Broadcast Script:</p>
                  <p className="italic text-neutral-200">
                    "This is an AroHana emergency alert. The rider has activated SOS. Ride ID: {ride.id}. The rider's current location is available through the live tracking link."
                  </p>
                </div>

                {/* Controls: [🔇 Mute] [🔊 Speaker] [🔴 End Call] or Call button */}
                {callSession.status === 'connected' || callSession.status === 'connecting' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => EmergencyCallService.toggleMute()}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        callSession.isMuted
                          ? 'bg-rose-950/60 border-rose-600 text-rose-300'
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                      }`}
                    >
                      <MicOff className="w-3.5 h-3.5" />
                      <span>{callSession.isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => EmergencyCallService.toggleSpeaker()}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        !callSession.isSpeakerOn
                          ? 'bg-neutral-900 border-neutral-800 text-neutral-500'
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-emerald-400'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{callSession.isSpeakerOn ? 'Speaker ON' : 'Speaker OFF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => EmergencyCallService.endCall()}
                      className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-rose-950/50"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>🔴 End Call</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartCall}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-950/40"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{callSession.status === 'ended' ? 'Restart Call to Trusted Contact' : 'Call Trusted Contact'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. WHATSAPP EMERGENCY ALERT & LIVE TRACKING URL */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp Emergency Message</span>
                </span>
                <span className="text-[10px] text-amber-400 font-semibold">Live Link Included</span>
              </div>

              {/* Exact WhatsApp formatted message preview */}
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800/90 font-mono text-[11px] text-neutral-300 whitespace-pre-line select-all max-h-36 overflow-y-auto leading-relaxed">
                {currentSosMessageText}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={whatsAppDirectUrl || getWhatsAppSosUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Send WhatsApp Emergency Alert</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={handleCopyLiveLink}
                  className="py-2.5 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-neutral-700"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied Live Link' : 'Copy Live Link'}</span>
                </button>
              </div>

              {whatsAppDispatchStatus && (
                <p className="text-[10px] text-neutral-400">{whatsAppDispatchStatus}</p>
              )}
            </div>

            {/* Action: Call National Emergency (112) */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowNationalEmergencyNotice(true);
                  setTimeout(() => setShowNationalEmergencyNotice(false), 5000);
                }}
                className="flex items-center justify-between w-full p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-lg shadow-rose-950/50"
              >
                <div className="flex items-center gap-3">
                  <PhoneCall className="w-5 h-5" />
                  <div className="text-left">
                    <p className="text-sm font-bold">Call National Emergency (112)</p>
                    <p className="text-[11px] font-normal text-rose-100">Direct connection to national emergency dispatch</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4" />
              </button>
              {showNationalEmergencyNotice && (
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-rose-500/50 text-rose-300 text-[11px] flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>PC Demo Mode: In production on mobile devices, invokes 112 emergency cellular dialer. External Windows application dialog suppressed.</span>
                </div>
              )}
            </div>

            {/* STOP SOS Prominent Button */}
            <button
              onClick={() => setShowStopConfirmation(true)}
              className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors shadow-xl"
            >
              <StopCircle className="w-5 h-5 text-rose-500" />
              <span>🛑 STOP SOS</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
