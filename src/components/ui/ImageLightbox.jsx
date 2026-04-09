import React from "react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";

export default function ImageLightbox({ src, alt = "", children }) {
  if (!src) return children;
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 border-none bg-black/90 shadow-none flex items-center justify-center">
        <img src={src} alt={alt} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
      </DialogContent>
    </Dialog>
  );
}
