'use client';

import React, { useState } from 'react';
import { Clock, Move, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

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

interface SlideTimelineProps {
  slides: Slide[];
  audioData: AudioData;
  onSlidesUpdate: (slides: Slide[]) => void;
  currentTime: number;
}

export function SlideTimeline({ slides, audioData, onSlidesUpdate, currentTime }: SlideTimelineProps) {
  const [selectedSlide, setSelectedSlide] = useState<string | null>(null);

  const updateSlideTime = (slideId: string, startTime: number) => {
    const updatedSlides = slides.map(slide => {
      if (slide.id === slideId) {
        return { ...slide, startTime };
      }
      return slide;
    });
    onSlidesUpdate(updatedSlides);
  };

  const updateSlideDuration = (slideId: string, duration: number) => {
    const updatedSlides = slides.map(slide => {
      if (slide.id === slideId) {
        return { ...slide, duration };
      }
      return slide;
    });
    onSlidesUpdate(updatedSlides);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSlidePosition = (slide: Slide) => {
    return (slide.startTime / audioData.duration) * 100;
  };

  const getSlideWidth = (slide: Slide) => {
    return (slide.duration / audioData.duration) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Timeline Visualization */}
      <div className="relative">
        <div className="h-20 bg-slate-700 rounded-lg relative overflow-hidden">
          {/* Audio Waveform Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-600 to-slate-500 opacity-30" />
          
          {/* Current Time Indicator */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20"
            style={{ left: `${(currentTime / audioData.duration) * 100}%` }}
          />
          
          {/* Slide Blocks */}
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute top-2 bottom-2 rounded cursor-pointer transition-all duration-200 ${
                selectedSlide === slide.id 
                  ? 'bg-purple-500 ring-2 ring-purple-300' 
                  : 'bg-purple-600/80 hover:bg-purple-500'
              }`}
              style={{
                left: `${getSlidePosition(slide)}%`,
                width: `${getSlideWidth(slide)}%`,
                minWidth: '2%'
              }}
              onClick={() => setSelectedSlide(slide.id)}
            >
              <div className="p-2 h-full flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  #{index + 1}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Time Labels */}
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>0:00</span>
          <span>{formatTime(audioData.duration)}</span>
        </div>
      </div>

      {/* Slide Details */}
      {selectedSlide && (
        <Card className="p-6 bg-slate-700/50 border-slate-600">
          {(() => {
            const slide = slides.find(s => s.id === selectedSlide);
            if (!slide) return null;
            
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-white">
                    Slide {slides.indexOf(slide) + 1} Settings
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSlide(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Start Time: {formatTime(slide.startTime)}
                      </label>
                      <Slider
                        value={[slide.startTime]}
                        onValueChange={([value]) => updateSlideTime(slide.id, value)}
                        max={audioData.duration}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Duration: {formatTime(slide.duration)}
                      </label>
                      <Slider
                        value={[slide.duration]}
                        onValueChange={([value]) => updateSlideDuration(slide.id, value)}
                        max={30}
                        min={1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <img
                      src={slide.imageUrl}
                      alt={`Slide ${slides.indexOf(slide) + 1}`}
                      className="max-h-32 rounded-lg shadow-lg"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      )}
    </div>
  );
}