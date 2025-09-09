'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Image } from 'lucide-react';

interface OfficeViewerProps {
  file: File;
  onSlidesExtracted: (slides: any[]) => void;
  onError: (error: string) => void;
}

export function OfficeViewer({ file, onSlidesExtracted, onError }: OfficeViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (file) {
      handleFileUpload();
    }
  }, [file]);

  const handleFileUpload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Method 1: Try Office.js viewer (if available)
      if (typeof window !== 'undefined' && (window as any).Office) {
        await loadWithOfficeJS();
        return;
      }

      // Method 2: Try direct image conversion
      await loadWithDirectConversion();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWithOfficeJS = async () => {
    try {
      // This would require Office.js to be loaded
      // For now, we'll show a placeholder
      console.log('Office.js viewer not implemented yet');
      throw new Error('Office.js viewer not available');
    } catch (error) {
      throw error;
    }
  };

  const loadWithDirectConversion = async () => {
    try {
      // Use our direct image conversion API
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/convert/pptx-to-images', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Conversion failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.images) {
        const slideData = result.images.map((imageData: string, index: number) => ({
          id: `slide-${index + 1}`,
          imageUrl: imageData,
          startTime: index * 10,
          duration: 10,
          text: `Slide ${index + 1}`,
          slideNumber: index + 1
        }));

        setSlides(slideData);
        onSlidesExtracted(slideData);
      } else {
        throw new Error(result.error || 'Conversion failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const captureSlideScreenshot = async (slideIndex: number) => {
    try {
      // This would capture a screenshot of the current slide
      // Implementation depends on the rendering method
      console.log(`Capturing screenshot of slide ${slideIndex + 1}`);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <p className="text-slate-300">PowerPointファイルを処理中...</p>
          <p className="text-sm text-slate-400">スライドを画像に変換しています</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-4">
          <FileText className="w-8 h-8 text-red-400" />
          <p className="text-red-400 font-medium">変換エラー</p>
          <p className="text-sm text-slate-400 text-center">{error}</p>
          <Button 
            onClick={handleFileUpload}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            再試行
          </Button>
        </div>
      </Card>
    );
  }

  if (slides.length === 0) {
    return (
      <Card className="p-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Image className="w-8 h-8 text-slate-400" />
          <p className="text-slate-300">スライドを読み込み中...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">PowerPoint Viewer</h3>
        <p className="text-sm text-slate-400">{slides.length}枚のスライド</p>
      </div>

      {/* Main Slide Display */}
      <div className="relative">
        <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden">
          <img
            src={slides[currentSlide]?.imageUrl}
            alt={`Slide ${currentSlide + 1}`}
            className="max-w-full max-h-full object-contain transition-opacity duration-500"
          />
          
          {/* Slide Counter */}
          <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
            {currentSlide + 1} / {slides.length}
          </div>

          {/* Navigation */}
          <div className="absolute inset-y-0 left-0 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
              disabled={currentSlide === 0}
              className="text-white hover:bg-white/20"
            >
              ←
            </Button>
          </div>
          
          <div className="absolute inset-y-0 right-0 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
              disabled={currentSlide === slides.length - 1}
              className="text-white hover:bg-white/20"
            >
              →
            </Button>
          </div>
        </div>
      </div>

      {/* Slide Thumbnails */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex space-x-3 overflow-x-auto pb-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(index)}
              className={`flex-shrink-0 relative transition-all duration-200 ${
                index === currentSlide
                  ? 'ring-2 ring-purple-500 scale-105'
                  : 'hover:scale-105 opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={slide.imageUrl}
                alt={`Slide ${index + 1}`}
                className="w-20 h-14 object-cover rounded border border-slate-600"
              />
              <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {index + 1}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
