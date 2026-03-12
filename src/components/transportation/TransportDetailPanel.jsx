import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, MapPin, Clock, User, Car, Phone, Pencil, Trash2, TimerReset, XCircle } from "lucide-react";

const statusColors = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  "In Transit": "bg-purple-50 text-purple-700 border-purple-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-slate-700 font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function TransportDetailPanel({ booking, onClose, onEdit, onDelete, onUpdateStatus, canAction = false }) {
  const nextStatus = {
    Pending: "Confirmed",
    Confirmed: "In Transit",
    "In Transit": "Completed",
  }[booking.status];

  return (
    <Card className="border-0 shadow-sm sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{booking.member_name}</CardTitle>
            <Badge variant="secondary" className={`text-xs border mt-1 ${statusColors[booking.status]}`}>
              {booking.status}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Row icon={MapPin} label="Pickup" value={booking.pickup_address} />
          <Row icon={MapPin} label="Destination" value={booking.destination} />
          <Row icon={Clock} label="Date & Time" value={`${booking.date} at ${booking.time}`} />
          <Row icon={User} label="Passengers" value={`${booking.passengers} passenger(s)`} />
          <Row icon={Phone} label="Contact" value={booking.contact_phone} />
          <Row icon={Car} label="Trip Type" value={booking.trip_type} />
          <Row icon={User} label="Driver" value={booking.driver_name} />
          <Row icon={Car} label="Vehicle" value={booking.vehicle} />
          {booking.notes && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">{booking.notes}</div>
          )}
        </div>

        {canAction && booking.status !== "Completed" && booking.status !== "Cancelled" && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quick Actions</p>
            <div className="flex gap-2 flex-wrap">
              {nextStatus && (
                <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => onUpdateStatus(booking.id, nextStatus)}>
                  <TimerReset className="h-3.5 w-3.5 mr-1" /> Mark {nextStatus}
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => onUpdateStatus(booking.id, "Cancelled")}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {canAction && (
          <div className="flex gap-2 pt-1 border-t border-slate-100">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(booking)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50"
              onClick={() => onDelete(booking)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}