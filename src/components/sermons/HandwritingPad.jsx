import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eraser, Undo2, Loader2, ArrowLeft } from "lucide-react";
/**
 * Stylus/finger handwriting pad. Captures strokes on a canvas and sends the
 * rendered image to the `transcribe-handwriting` edge function. Returns the
 * recognized text via onConvert(text).
 */
export default function HandwritingPad({ open, onOpenChange, onConvert }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const strokesRef = useRef([]); // array of strokes; each stroke = array of points
  const currentStrokeRef = useRef(null);
  const [thickness, setThickness] = useState(3);
  const [converting, setConverting] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [view, setView] = useState("pad"); // "pad" | "review"
  const [draftText, setDraftText] = useState("");

  // Resize canvas to its CSS size with devicePixelRatio
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a0a0a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctxRef.current = ctx;
    redraw();
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0a0a0a";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 1) continue;
      ctx.beginPath();
      ctx.lineWidth = stroke[0].w;
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
    setHasStrokes(strokesRef.current.length > 0);
  };

  useEffect(() => {
    if (!open) return;
    strokesRef.current = [];
    setHasStrokes(false);
    setView("pad");
    setDraftText("");
    // Defer to next frame so dialog has laid out
    const id = requestAnimationFrame(() => setupCanvas());
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = getPos(e);
    // Pen pressure scales thickness slightly when available
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    const w = thickness * (0.6 + pressure * 0.8);
    currentStrokeRef.current = [{ x, y, w }];
    strokesRef.current.push(currentStrokeRef.current);
  };

  const handlePointerMove = (e) => {
    if (!drawingRef.current) return;
    const { x, y } = getPos(e);
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    const last = stroke[stroke.length - 1];
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.lineWidth = last.w;
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    const w = thickness * (0.6 + pressure * 0.8);
    stroke.push({ x, y, w });
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    currentStrokeRef.current = null;
    setHasStrokes(strokesRef.current.length > 0);
  };

  const handleUndo = () => {
    strokesRef.current.pop();
    redraw();
  };

  const handleClear = () => {
    strokesRef.current = [];
    redraw();
  };

  const handleConvert = async () => {
    if (!hasStrokes) {
      toast.error("Write something first.");
      return;
    }
    setConverting(true);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const { data, error } = await supabase.functions.invoke("transcribe-handwriting", {
        body: { imageBase64: dataUrl },
      });
      if (error) throw error;
      const text = (data?.text || "").trim();
      if (!text) {
        toast.error("Couldn't read that — try writing larger or clearer.");
        return;
      }
      setDraftText(text);
      setView("review");
    } catch (err) {
      toast.error(err.message || "Failed to transcribe handwriting.");
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Handwriting → Text</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs whitespace-nowrap">Pen size</Label>
            <Slider
              value={[thickness]}
              onValueChange={(v) => setThickness(v[0])}
              min={1}
              max={10}
              step={1}
              className="max-w-[160px]"
            />
            <div className="flex-1" />
            <Button type="button" size="sm" variant="ghost" onClick={handleUndo} disabled={!hasStrokes || converting}>
              <Undo2 className="h-4 w-4 mr-1" /> Undo
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleClear} disabled={!hasStrokes || converting}>
              <Eraser className="h-4 w-4 mr-1" /> Clear
            </Button>
          </div>
          <div className="rounded-md border border-input bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full h-[360px] touch-none cursor-crosshair block"
              style={{ touchAction: "none" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Write with your finger or stylus (Apple Pencil, S Pen). Tap “Convert to text” to insert it into your notes.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={converting}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={converting || !hasStrokes}>
            {converting ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Converting…</>
            ) : (
              "Convert to text"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
