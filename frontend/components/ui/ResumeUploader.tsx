'use client';

import React, { useState } from 'react';
import { Upload, FileText, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResumeUploaderProps {
  onComplete: (resumeText: string) => void;
  onSkip?: () => void;
}

export default function ResumeUploader({ onComplete, onSkip }: ResumeUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload an image (JPG, PNG), PDF, or TXT file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const processFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      if (selectedFile.type === 'text/plain') {
        // Read text file directly
        const text = await selectedFile.text();
        localStorage.setItem('userResume', text);
        onComplete(text);
      } else if (selectedFile.type === 'application/pdf') {
        // For PDF, we'll need to extract text (simplified version - in production use pdf.js)
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const text = e.target?.result as string;
            // This is a simplified extraction - in production, use pdf.js or a backend service
            localStorage.setItem('userResume', `[PDF Resume: ${selectedFile.name}]\n${text}`);
            localStorage.setItem('userResumeFileName', selectedFile.name);
            onComplete(text);
          } catch (err) {
            setError('Failed to process PDF. Try pasting text instead.');
            setIsProcessing(false);
          }
        };
        reader.readAsText(selectedFile);
      } else if (selectedFile.type.startsWith('image/')) {
        // For images, store the file name and indicate OCR may be needed
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          // In production, send this to OCR API (Google Vision, Tesseract.js, etc.)
          const resumeText = `[Image Resume: ${selectedFile.name}]\nOCR processing required - please paste text manually if needed.`;
          localStorage.setItem('userResume', resumeText);
          localStorage.setItem('userResumeImage', dataUrl);
          localStorage.setItem('userResumeFileName', selectedFile.name);
          onComplete(resumeText);
        };
        reader.readAsDataURL(selectedFile);
      }
    } catch (err) {
      console.error('Error processing file:', err);
      setError('Failed to process file. Please try pasting text instead.');
      setIsProcessing(false);
    }
  };

  const handlePastedTextSubmit = () => {
    if (!pastedText.trim()) {
      setError('Please paste your resume text');
      return;
    }

    setIsProcessing(true);
    try {
      localStorage.setItem('userResume', pastedText.trim());
      onComplete(pastedText.trim());
    } catch (err) {
      setError('Failed to save resume. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      // If no skip handler provided, save empty resume and continue
      localStorage.setItem('userResume', '');
      onComplete('');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Upload Your Resume
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Help our AI personalize interview questions based on your experience
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
            activeTab === 'upload'
              ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload File
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
            activeTab === 'paste'
              ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Paste Text
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Upload Tab Content */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  <X className="w-4 h-4 inline mr-1" />
                  Remove
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Drag and drop your resume here
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  or click to browse files
                </p>
                <input
                  type="file"
                  id="resume-upload"
                  accept="image/*,.pdf,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <label htmlFor="resume-upload">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    onClick={() => document.getElementById('resume-upload')?.click()}
                  >
                    Select File
                  </Button>
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                  Supported formats: JPG, PNG, PDF, TXT (Max 5MB)
                </p>
              </>
            )}
          </div>

          {selectedFile && (
            <Button
              onClick={processFile}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-6 text-lg font-semibold"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Continue with Resume
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Paste Tab Content */}
      {activeTab === 'paste' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Paste your resume text below
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                setError(null);
              }}
              placeholder="Paste your resume content here... Include your skills, experience, education, etc."
              className="w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {pastedText.length} characters
            </p>
          </div>

          <Button
            onClick={handlePastedTextSubmit}
            disabled={isProcessing || !pastedText.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Continue with Resume
              </>
            )}
          </Button>
        </div>
      )}

      {/* Skip Button */}
      <div className="mt-6 text-center">
        <button
          onClick={handleSkip}
          disabled={isProcessing}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium disabled:opacity-50"
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}
