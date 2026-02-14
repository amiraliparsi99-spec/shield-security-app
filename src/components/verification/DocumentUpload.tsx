"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VerificationStatus } from "@/types/database";

interface DocumentUploadProps {
  ownerType: "personnel" | "agency";
  ownerId: string;
  documentType: string;
  documentName: string;
  onUploadComplete?: (documentId: string) => void;
  onError?: (error: string) => void;
}

export function DocumentUpload({
  ownerType,
  ownerId,
  documentType,
  documentName,
  onUploadComplete,
  onError,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      onError?.("Invalid file type. Please upload PDF, JPG, or PNG files only.");
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      onError?.("File size too large. Maximum size is 10MB.");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const supabase = createClient();

      // Generate unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${ownerType}/${ownerId}/${documentType}-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("verification-documents").getPublicUrl(fileName);

      // Create document record in database
      // Don't specify status - let the database default handle it (pending)
      const { data: documentData, error: dbError } = await supabase
        .from("verification_documents")
        .insert({
          owner_type: ownerType,
          owner_id: ownerId,
          document_type: documentType,
          document_name: documentName,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          // status is omitted - will use default 'pending' from database
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setProgress(100);
      onUploadComplete?.(documentData.id);
    } catch (error: any) {
      console.error("Upload error:", error);
      onError?.(error.message || "Failed to upload document. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-6 transition-colors ${
        dragActive
          ? "border-shield-500 bg-shield-500/10"
          : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500"
      } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id={`file-upload-${documentType}`}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleChange}
        disabled={uploading}
      />
      <label
        htmlFor={`file-upload-${documentType}`}
        className="flex flex-col items-center justify-center cursor-pointer"
      >
        {uploading ? (
          <>
            <div className="w-12 h-12 border-4 border-shield-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-zinc-400">Uploading... {progress}%</p>
          </>
        ) : (
          <>
            <svg
              className="w-12 h-12 text-zinc-500 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium text-white mb-1">
              {dragActive ? "Drop file here" : "Click to upload or drag and drop"}
            </p>
            <p className="text-xs text-zinc-500">PDF, JPG, or PNG (max 10MB)</p>
          </>
        )}
      </label>
    </div>
  );
}
