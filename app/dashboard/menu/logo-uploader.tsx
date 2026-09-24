"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Upload, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function LogoUploader({
  logo,
  onChange,
}: {
  logo: string | null;
  onChange: (logo: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOriginalImage(url);
    setRawImage(url);
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
        className="group absolute inset-0 z-0 flex cursor-pointer items-center justify-center rounded-lg text-white transition hover:bg-black/35 focus-visible:bg-black/35 focus-visible:outline-none"
        aria-label="Subir logo"
      >
        <span className="flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-medium opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Upload className="h-3.5 w-3.5" />
          Subir logo
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute -bottom-1 -right-1 z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-sm outline-none hover:bg-primary-hover"
        >
          <Camera className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-44">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 text-text-secondary" />
            Subir imagen
          </DropdownMenuItem>
          {logo && (
            <>
              <DropdownMenuItem onClick={() => setRawImage(originalImage ?? logo)}>
                <Pencil className="h-4 w-4 text-text-secondary" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onChange(null)}>
                <Trash2 className="h-4 w-4" />
                Remover
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {rawImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-lg">
            <p className="mb-3 text-sm font-medium text-text-primary">Recortar logo</p>
            <div className="relative h-64 w-full overflow-hidden rounded-lg bg-surface">
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
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
                onClick={() => setRawImage(null)}
                className="rounded px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCrop}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
