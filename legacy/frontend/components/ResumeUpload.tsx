"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, X, Loader2, CheckCircle } from "lucide-react";

interface ResumeUploadProps {
  onResumeProcessed: (text: string) => void;
  onSkip: () => void;
}

export default function ResumeUpload({ onResumeProcessed, onSkip }: ResumeUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!validTypes.includes(selectedFile.type)) {
      setError("Please upload a PDF, DOCX, or TXT file");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/resume/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process resume");
      }

      const data = await response.json();
      setSuccess(true);
      
      setTimeout(() => {
        onResumeProcessed(data.text);
      }, 500);
    } catch (err) {
      setError("Failed to process resume. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-[#0A0A0F] border border-white/10 rounded-2xl p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Upload Your Resume</h2>
          <p className="text-sm text-white/60">
            Optional: Upload your resume to personalize interview questions
          </p>
        </div>

        {/* Upload Area */}
        {!file ? (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-white/20 rounded-xl p-12 hover:border-white/40 transition-all text-center">
              <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
              <p className="text-white/80 font-medium mb-1">Click to upload</p>
              <p className="text-xs text-white/40">PDF, DOCX, or TXT (max 5MB)</p>
            </div>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        ) : (
          <div className="border border-white/10 rounded-xl p-4 bg-white/5 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-400" />
            <div className="flex-1">
              <p className="text-white font-medium truncate">{file.name}</p>
              <p className="text-xs text-white/40">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {!loading && !success && (
              <button
                onClick={() => setFile(null)}
                className="p-2 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            )}
            {success && <CheckCircle className="w-6 h-6 text-green-400" />}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onSkip}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 transition-all disabled:opacity-50"
          >
            Skip
          </button>
          
          {file && !success && (
            <button
              onClick={handleUpload}
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue"
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
