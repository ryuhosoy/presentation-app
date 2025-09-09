'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, Fullscreen as FullScreen, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Slide {
  id: string;
  imageUrl: string;
  startTime: number;
  duration: number;
  text?: string;
}

interface AudioData {
  url: string;
  duration: number;
  blob?: Blob;
}

interface PresentationPlayerProps {
  slides: Slide[];
  audioData: AudioData | null;
  currentSlide: number;
  onSlideChange: (index: number) => void;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
}

export function PresentationPlayer({
  slides,
  audioData,
  currentSlide,
  onSlideChange,
  isPlaying,
  onPlayingChange
}: PresentationPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isPlaying || !audioData) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 0.1;
        
        // Auto-advance slides based on timing
        const activeSlideIndex = slides.findIndex(slide => 
          newTime >= slide.startTime && newTime < slide.startTime + slide.duration
        );
        
        if (activeSlideIndex !== -1 && activeSlideIndex !== currentSlide) {
          onSlideChange(activeSlideIndex);
        }
        
        if (newTime >= (audioData?.duration || 0)) {
          onPlayingChange(false);
          return 0;
        }
        
        return newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, audioData, slides, currentSlide, onSlideChange, onPlayingChange]);

  const progress = audioData ? (currentTime / audioData.duration) * 100 : 0;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const generateVideo = () => {
    // In a real implementation, this would trigger video generation
    alert('Video generation would start here. In production, this would use ffmpeg or similar tools to create an MP4 file.');
  };

  return (
    <Card className="overflow-hidden bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      {/* Player Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Presentation Player</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={generateVideo}
              className="text-slate-400 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Generate Video
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-slate-400 hover:text-white"
            >
              <FullScreen className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Player */}
      <div className="relative">
        {/* Slide Display */}
        <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden">
          {slides.length > 0 ? (
            <>
              <img
                src={slides[currentSlide]?.imageUrl}
                alt={`Slide ${currentSlide + 1}`}
                className="max-w-full max-h-full object-contain transition-opacity duration-500"
                onError={(e) => {
                  // Fallback for broken images
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
              />
              
              {/* Fallback content for broken images */}
              <div className="hidden flex-col items-center justify-center text-center text-slate-400 p-8">
                <div className="w-16 h-16 border-4 border-dashed border-slate-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Play className="w-6 h-6" />
                </div>
                <p className="text-lg font-medium">Slide {currentSlide + 1}</p>
                <p className="text-sm opacity-80 mt-2">
                  {slides[currentSlide]?.text || 'No content available'}
                </p>
              </div>
              
              {/* Slide Counter */}
              <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                {currentSlide + 1} / {slides.length}
              </div>

              {/* Current Slide Info */}
              <div className="absolute bottom-4 left-4 bg-black/50 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
                <div className="text-sm opacity-80">Now showing:</div>
                <div className="font-medium">Slide {currentSlide + 1}</div>
                {slides[currentSlide]?.text && (
                  <div className="text-xs opacity-60 mt-1 max-w-xs truncate">
                    {slides[currentSlide].text}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400">
              <div className="w-24 h-24 border-4 border-dashed border-slate-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8" />
              </div>
              <p>Upload slides to start creating your presentation</p>
            </div>
          )}
        </div>

        {/* Player Controls */}
        <div className="p-6 bg-slate-800/70">
          {/* Progress Bar */}
          <div className="mb-4">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{audioData ? formatTime(audioData.duration) : '0:00'}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}
              disabled={!audioData}
              className="text-slate-400 hover:text-white"
            >
              <SkipBack className="w-5 h-5" />
            </Button>

            <Button
              onClick={() => onPlayingChange(!isPlaying)}
              disabled={!audioData || slides.length === 0}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 w-14 h-14 rounded-full"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentTime(Math.min(audioData?.duration || 0, currentTime + 10))}
              disabled={!audioData}
              className="text-slate-400 hover:text-white"
            >
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Slide Thumbnails */}
      {slides.length > 0 && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex space-x-3 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => onSlideChange(index)}
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
                  onError={(e) => {
                    // Fallback for broken thumbnail images
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) {
                      fallback.style.display = 'flex';
                    }
                  }}
                />
                
                {/* Fallback for broken thumbnail images */}
                <div className="hidden w-20 h-14 bg-slate-700 rounded border border-slate-600 flex-col items-center justify-center text-center">
                  <div className="text-xs text-slate-400 font-medium">{index + 1}</div>
                  <div className="text-xs text-slate-500 truncate px-1">
                    {slide.text?.substring(0, 10) || 'Slide'}
                  </div>
                </div>
                
                <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {index + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function SkipBack({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m11 17-5-5 5-5m6 10-5-5 5-5" />
    </svg>
  );
}

function SkipForward({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m7 17 5-5-5-5m6 10 5-5-5-5" />
    </svg>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}