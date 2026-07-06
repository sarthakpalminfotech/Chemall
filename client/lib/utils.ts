import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const handleAudioCapture = (
  onResult: (file: File) => void
) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "audio/*";
  input.capture = "microphone";
  input.onchange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      onResult(file);
    }
  };
  input.click();
};

export const handleCameraCapture = (
  onResult: (file: File) => void
) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.onchange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      onResult(file);
    }
  };
  input.click();
};
