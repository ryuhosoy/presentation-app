'use client';

import React, { useCallback, useState } from 'react';
import { Upload, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesUpload: (files: File[]) => void;
  acceptedTypes: string;
  multiple?: boolean;
  placeholder: string;
  className?: string;
  fileType?: 'slides' | 'audio' | 'general';
}

export function FileUpload({ 
  onFilesUpload, 
  acceptedTypes, 
  multiple = false, 
  placeholder,
  className,
  fileType = 'general'
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  }, []);

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      let isValidType = false;
      
      if (acceptedTypes === "*/*") {
        isValidType = true;
      } else if (fileType === 'slides') {
        // Accept PowerPoint files and images
        isValidType = file.type.includes('image/') || 
                     file.name.endsWith('.pptx') || 
                     file.name.endsWith('.pdf');
      } else {
        isValidType = file.type.match(acceptedTypes.replace('*', '.*')) !== null;
      }
      
      return isValidType;
    });

    if (validFiles.length > 0) {
      setIsProcessing(true);
      setUploadedFiles(multiple ? [...uploadedFiles, ...validFiles] : validFiles);
      onFilesUpload(validFiles);
      
      // Reset processing state after a delay
      setTimeout(() => setIsProcessing(false), 1000);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onFilesUpload(newFiles);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
          isDragging 
            ? "border-purple-400 bg-purple-500/10" 
            : "border-slate-600 hover:border-slate-500 bg-slate-700/30",
          isProcessing && "border-blue-400 bg-blue-500/10"
        )}
      >
        <input
          type="file"
          accept={acceptedTypes}
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
          id={`file-upload-${acceptedTypes.replace('/', '-')}`}
        />
        
        <label
          htmlFor={`file-upload-${acceptedTypes.replace('/', '-')}`}
          className="cursor-pointer block"
        >
          <Upload className={cn(
            "w-12 h-12 mx-auto mb-4 transition-colors",
            isDragging ? "text-purple-400" : 
            isProcessing ? "text-blue-400 animate-pulse" : "text-slate-400"
          )} />
          
          <p className="text-lg font-medium text-white mb-2">
            {isDragging ? "Drop files here" : 
             isProcessing ? "Processing files..." : 
             "Upload files"}
          </p>
          <p className="text-sm text-slate-400">
            {placeholder}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Click to browse or drag & drop
          </p>
        </label>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">
            {fileType === 'slides' ? 'Presentation Files:' : 'Uploaded Files:'}
          </h4>
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <File className="w-4 h-4 text-slate-400" />
                <div className="flex flex-col">
                  <span className="text-sm text-white truncate">{file.name}</span>
                  {file.name.endsWith('.pptx') && (
                    <span className="text-xs text-purple-400">PowerPoint Presentation</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-slate-600 rounded transition-colors"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}