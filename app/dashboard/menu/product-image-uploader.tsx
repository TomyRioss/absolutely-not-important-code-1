"use client";

import NextImage from "next/image";

import { useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { Camera } from "lucide-react";

async function getCroppedImage(imageSrc: string, area: Area): Promise<string> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const MAX_SIZE = 1024;
  const scale = Math.min(1, MAX_SIZE / Math.max(area.width, area.height));

  const canvas = document.createElement("canvas");
  canvas.width = area.width * scale;
  canvas.height = area.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ProductImageUploader({
  image,
  onChange,
  size = "sm",
}: {
  image: string | null;
  onChange: (image: string) => void;
  size?: "sm" | "lg";
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawImage(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function handleConfirmCrop() {
    if (!rawImage || !croppedArea) return;
    const cropped = await getCroppedImage(rawImage, croppedArea);
    onChange(cropped);
    setRawImage(null);
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-background text-text-secondary ${
          size === "lg" ? "h-24 w-24" : "h-10 w-10"
        } ${!image ? "border border-dashed border-border" : ""}`}
        title="Subir imagen"
      >
        {image ? (
          <NextImage src={image} alt="" fill unoptimized className="object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-text-secondary">
            <Camera className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
            {size === "lg" && <span className="text-[11px]">Subir foto</span>}
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100">
          <Camera className={size === "lg" ? "h-6 w-6 text-white" : "h-4 w-4 text-white"} />
        </span>
      </button>

      {rawImage &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-lg">
              <p className="mb-3 text-base font-medium text-text-primary">Recortar imagen</p>
              <div className="relative h-[28rem] w-full overflow-hidden rounded-lg bg-surface">
                <Cropper
                  image={rawImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, area) => setCroppedArea(area)}
                />
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRawImage(null)}
                  className="rounded px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCrop}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
