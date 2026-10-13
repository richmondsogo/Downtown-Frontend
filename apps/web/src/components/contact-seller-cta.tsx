"use client";

import * as React from "react";
import { useSession } from "@/lib/auth-client";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampusSafetyNotice } from "@/components/campus-safety-notice";
import { formatNaira, normalizeNigerianPhone, isValidNigerianPhone } from "@downtown/utils";
import {
  MessageSquare,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Phone,
  RefreshCw,
} from "lucide-react";

export interface ContactSellerCtaProps {
  listingId: string;
  title: string;
  price: number;
  isNegotiable: boolean;
  quantityAvailable: number;
  availability: "available" | "reserved" | "sold";
  initialActiveRequest?: {
    id: string;
    requestedQuantity: number;
    offerPrice?: number | null;
    reservationExpiresAt: string;
  } | null;
}

export function ContactSellerCta({
  listingId,
  title,
  price,
  isNegotiable,
  quantityAvailable,
  availability,
  initialActiveRequest,
}: ContactSellerCtaProps) {
  const { data: session, isPending: sessionLoading } = useSession();
  const [showAuthGate, setShowAuthGate] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [activeRequest, setActiveRequest] = React.useState(initialActiveRequest || null);

  // Form state
  const [quantity, setQuantity] = React.useState(1);
  const [offerPriceInput, setOfferPriceInput] = React.useState("");
  const [phoneInput, setPhoneInput] = React.useState("");
  const [phoneError, setPhoneError] = React.useState("");
  const [offerError, setOfferError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState("");

  // Result state
  const [whatsappUrl, setWhatsappUrl] = React.useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = React.useState(false);

  // Cancellation state
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState("");

  const userPhone = (session?.user as any)?.phone;

  // Auto-fill phone from session if present
  React.useEffect(() => {
    if (userPhone && !phoneInput) {
      setPhoneInput(userPhone);
    }
  }, [userPhone, phoneInput]);

  const handleOpenContact = () => {
    if (!session?.user) {
      setShowAuthGate(true);
      return;
    }
    setApiError("");
    setOfferError("");
    setPhoneError("");
    setRequestSubmitted(false);
    setWhatsappUrl(null);
    setShowModal(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneInput(e.target.value);
    setPhoneError("");
  };

  const handleOfferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOfferPriceInput(val);
    setOfferError("");
  };

  const offerNum = offerPriceInput ? parseInt(offerPriceInput, 10) : null;
  const isOfferBelow50 = offerNum !== null && offerNum > 0 && offerNum < price * 0.5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    setOfferError("");
    setPhoneError("");

    // 1. Phone validation if not already on profile
    let validatedPhone = userPhone;
    if (!validatedPhone) {
      if (!phoneInput) {
        setPhoneError("Phone number is required before contacting the seller.");
        return;
      }
      if (!isValidNigerianPhone(phoneInput)) {
        setPhoneError("Please enter a valid Nigerian mobile number (e.g. 08012345678).");
        return;
      }
      try {
        validatedPhone = normalizeNigerianPhone(phoneInput);
      } catch (err: any) {
        setPhoneError(err.message || "Invalid phone number format.");
        return;
      }
    }

    // 2. Offer validation
    let offerPrice: number | undefined = undefined;
    if (offerNum !== null && !isNaN(offerNum)) {
      if (!isNegotiable) {
        setOfferError("This listing does not accept custom offers.");
        return;
      }
      const minOffer = Math.round(price * 0.1);
      if (offerNum < minOffer || offerNum > price) {
        setOfferError(`Offer must be between 10% and 100% of price (${formatNaira(minOffer)} - ${formatNaira(price)}).`);
        return;
      }
      offerPrice = offerNum;
    }

    setIsSubmitting(true);

    try {
      // If user lacks phone on profile, update phone first
      if (!userPhone && validatedPhone) {
        const phoneRes = await fetch("/api/user/phone", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: validatedPhone }),
        });
        if (!phoneRes.ok) {
          const pErr = await phoneRes.json().catch(() => ({}));
          throw new Error(pErr.message || "Failed to save phone number to profile.");
        }
      }

      // Submit purchase request
      const res = await fetch(`/api/listings/${listingId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedQuantity: quantity,
          offerPrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit purchase request.");
      }

      setWhatsappUrl(data.whatsappUrl);
      setRequestSubmitted(true);
      setActiveRequest({
        id: data.request.id,
        requestedQuantity: data.request.requestedQuantity,
        offerPrice: data.request.offerPrice,
        reservationExpiresAt: data.request.reservationExpiresAt,
      });

      // Try automatic open on click (will be popup blocked in some browsers, but fallback button is prominent)
      if (typeof window !== "undefined" && data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setApiError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!activeRequest) return;
    setIsCancelling(true);
    setCancelError("");

    try {
      const res = await fetch(`/api/requests/${activeRequest.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Buyer cancelled from listing detail" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to cancel request");
      }
      setActiveRequest(null);
      setShowModal(false);
    } catch (err: any) {
      setCancelError(err.message || "Failed to cancel request");
    } finally {
      setIsCancelling(false);
    }
  };

  // State 1: Item Sold
  if (availability === "sold") {
    return (
      <div className="pt-3 border-t border-border/60 space-y-2">
        <Button
          disabled
          className="w-full h-12 text-sm sm:text-base font-semibold opacity-70 cursor-not-allowed bg-muted text-muted-foreground border border-border"
        >
          <Lock className="h-4 w-4 mr-2" />
          <span>Item Sold</span>
        </Button>
        <p className="text-center text-[11px] text-muted-foreground leading-tight">
          This item has been confirmed sold and is no longer available.
        </p>
      </div>
    );
  }

  // State 2: Active Request Pending for current user
  if (activeRequest) {
    const expiresDate = new Date(activeRequest.reservationExpiresAt);
    const isHoldActive = expiresDate.getTime() > Date.now();

    return (
      <div className="pt-3 border-t border-border/60 space-y-3">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Active Purchase Request
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isHoldActive ? "Stock Held (24h)" : "Negotiating"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            You requested {activeRequest.requestedQuantity} unit
            {activeRequest.requestedQuantity > 1 ? "s" : ""}
            {activeRequest.offerPrice ? ` at ${formatNaira(activeRequest.offerPrice)}` : ""}.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              onClick={handleOpenContact}
              className="flex-1 h-10 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <MessageSquare className="h-4 w-4 mr-1.5" />
              <span>Open WhatsApp</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelRequest}
              disabled={isCancelling}
              className="h-10 text-xs text-muted-foreground hover:text-destructive border-border"
            >
              {isCancelling ? "Cancelling..." : "Cancel Request"}
            </Button>
          </div>
          {cancelError && (
            <p className="text-[11px] text-destructive">{cancelError}</p>
          )}
        </div>
      </div>
    );
  }

  // State 3: Item Reserved (Out of Stock / 0 Unreserved)
  if (availability === "reserved") {
    return (
      <div className="pt-3 border-t border-border/60 space-y-2">
        <Button
          disabled
          className="w-full h-12 text-sm sm:text-base font-semibold opacity-70 cursor-not-allowed bg-muted text-muted-foreground border border-border"
        >
          <Lock className="h-4 w-4 mr-2" />
          <span>Item Reserved</span>
        </Button>
        <p className="text-center text-[11px] text-muted-foreground leading-tight">
          All inventory is currently reserved by active buyer requests. If a hold lapses or is cancelled, it will become available again immediately.
        </p>
      </div>
    );
  }

  // State 4: Available -> Active Contact Button
  return (
    <>
      <div className="pt-3 border-t border-border/60 space-y-2">
        <Button
          onClick={handleOpenContact}
          className="w-full h-12 text-sm sm:text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          <span>Contact Seller on WhatsApp</span>
        </Button>
        <p className="text-center text-[11px] text-muted-foreground leading-tight">
          Holds inventory for 24h and generates a direct WhatsApp message.
        </p>
      </div>

      {/* Auth Soft Gate Modal */}
      <AuthGateModal
        isOpen={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        title="Sign in to Contact Seller"
        description="Downtown requires student, staff, or vendor accounts to contact sellers and reserve inventory safely."
        returnTo={`/listings/${listingId}`}
      />

      {/* Contact Seller Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-md space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 id="contact-modal-title" className="text-base font-bold text-foreground">
                  {requestSubmitted ? "Request Sent!" : "Contact Seller"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {title} &bull; {formatNaira(price)}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-sm"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            {requestSubmitted && whatsappUrl ? (
              <div className="space-y-4 pt-1">
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4 text-center space-y-2">
                  <div className="h-10 w-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Your 24-hour reservation is active!
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We held stock for you. Click the button below to open your pre-filled message on WhatsApp.
                  </p>
                </div>

                <CampusSafetyNotice />

                {/* Primary WhatsApp Link Button (Popup Blocker Immune) */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <Button className="w-full h-12 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    <span>Open WhatsApp</span>
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-80" />
                  </Button>
                </a>

                <Button
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  className="w-full text-xs text-muted-foreground"
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {apiError && (
                  <div className="p-3 rounded-md border border-destructive/20 bg-destructive/5 text-destructive text-xs">
                    {apiError}
                  </div>
                )}

                {/* Inline Phone Input if missing on profile */}
                {!userPhone && (
                  <div className="space-y-1.5">
                    <Label htmlFor="buyer-phone" className="text-xs font-semibold text-foreground">
                      Your Phone Number (Required)
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="buyer-phone"
                        type="tel"
                        placeholder="e.g. 08012345678"
                        value={phoneInput}
                        onChange={handlePhoneChange}
                        className="pl-9 h-10 text-sm"
                        required
                      />
                    </div>
                    {phoneError ? (
                      <p className="text-[11px] text-destructive">{phoneError}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Phone is self-declared and unverified. It is only shared via WhatsApp.
                      </p>
                    )}
                  </div>
                )}

                {/* Quantity Selector */}
                {quantityAvailable > 1 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="request-quantity" className="text-xs font-semibold text-foreground">
                      Quantity (Up to {quantityAvailable} available)
                    </Label>
                    <Input
                      id="request-quantity"
                      type="number"
                      min={1}
                      max={quantityAvailable}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="h-10 text-sm"
                    />
                  </div>
                )}

                {/* Offer Input (if negotiable) */}
                {isNegotiable && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="request-offer" className="text-xs font-semibold text-foreground">
                        Make an Offer (₦, Optional)
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        Listing price: {formatNaira(price)}
                      </span>
                    </div>
                    <Input
                      id="request-offer"
                      type="number"
                      placeholder={`e.g. ${Math.round(price * 0.85)}`}
                      value={offerPriceInput}
                      onChange={handleOfferChange}
                      className="h-10 text-sm"
                    />
                    {offerError && (
                      <p className="text-[11px] text-destructive">{offerError}</p>
                    )}
                    {isOfferBelow50 && !offerError && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Offers below 50% may be ignored by the seller.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Verbatim SRS Safety Sentence */}
                <CampusSafetyNotice />

                {/* Submit Action */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        <span>Continue to WhatsApp</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
