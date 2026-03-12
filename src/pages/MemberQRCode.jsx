import React, { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function MemberQRCode() {
    const [copied, setCopied] = useState(false);
    const qrRef = useRef(null);

    const pageUrl = createPageUrl("PublicMemberRegistration");
    const fullUrl = `${window.location.origin}${pageUrl.startsWith("/") ? "" : "/"}${pageUrl}`;

    const handleDownload = () => {
        const canvas = qrRef.current?.querySelector("canvas");
        if (!canvas) return;
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = "member-registration-qr.png";
        a.click();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Member Registration QR Code</h1>
                <p className="text-slate-500 mt-1">Share this QR code or link so new members can register without an account.</p>
            </div>

            {/* QR Card */}
            <Card className="overflow-hidden">
                <div className="bg-gradient-to-br from-[#1e3a5f] to-[#0f1f33] px-6 py-8 text-center">
                    <p className="text-white/70 text-sm mb-4 font-medium tracking-wide uppercase">Winners Chapel International Cardiff</p>
                    <div ref={qrRef} className="bg-white rounded-2xl p-4 inline-block shadow-lg">
                        <QRCodeCanvas
                            value={fullUrl}
                            size={256}
                            fgColor="#1e3a5f"
                            bgColor="#ffffff"
                            level="H"
                        />
                    </div>
                    <p className="text-white/60 text-xs mt-4">Scan to register as a new member</p>
                </div>
                <CardContent className="p-6 space-y-4">
                    {/* URL display */}
                    <div>
                        <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Registration Link</p>
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border">
                            <p className="text-sm text-slate-700 flex-1 break-all">{fullUrl}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                        <Button onClick={handleDownload} className="bg-[#1e3a5f] hover:bg-[#0f1f33] text-white gap-2">
                            <Download className="h-4 w-4" />
                            Download QR
                        </Button>
                        <Button variant="outline" onClick={handleCopy} className="gap-2">
                            {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            {copied ? "Copied!" : "Copy Link"}
                        </Button>
                        <Link to={createPageUrl("PublicMemberRegistration")} target="_blank">
                            <Button variant="outline" className="gap-2">
                                <ExternalLink className="h-4 w-4" />
                                Preview Form
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Usage tips */}
            <Card>
                <CardContent className="p-6">
                    <h3 className="font-semibold text-slate-800 mb-3">How to use</h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-start gap-2">
                            <span className="h-5 w-5 rounded-full bg-[#1e3a5f] text-white text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                            Download the QR code image and print it on flyers, banners, or welcome cards.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="h-5 w-5 rounded-full bg-[#1e3a5f] text-white text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                            New visitors scan the code with their phone camera — no app download required.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="h-5 w-5 rounded-full bg-[#1e3a5f] text-white text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                            They fill in the form and their details are automatically added to the Members database.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="h-5 w-5 rounded-full bg-[#1e3a5f] text-white text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
                            You can also share the link via WhatsApp, email, or social media.
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}