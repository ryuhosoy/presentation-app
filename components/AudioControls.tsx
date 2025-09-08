'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';

interface AudioData {
  url: string;
  duration: number;
  blob?: Blob;
}

interface AudioControlsProps {
  audioData: AudioData;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  onTimeUpdate?: (time: number) => void;
}

export function AudioControls({ 
  audioData, 
  isPlaying, 
  onPlayingChange,
  onTimeUpdate 
}: AudioControlsProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(audioData.duration, currentTime + seconds));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / audioData.duration) * 100;

  return (
    <div className="space-y-6">
      {/* Audio Element */}
      {audioData.url && (
        <audio
          ref={audioRef}
          src={audioData.url}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => onPlayingChange(false)}
          onLoadedMetadata={handleTimeUpdate}
        />
      )}

      {/* Waveform Visualization */}
      <div className="relative h-16 bg-slate-800 rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex items-center">
          {/* Simple waveform visualization */}
          {Array.from({ length: 50 }, (_, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-purple-600 to-blue-500 mx-px rounded-sm opacity-60"
              style={{
                height: `${Math.random() * 60 + 20}%`,
                transform: `scaleY(${i < (progress / 2) ? 1 : 0.3})`,
                transition: 'transform 0.1s ease'
              }}
            />
          ))}
        </div>
        
        {/* Progress Overlay */}
        <div 
          className="absolute top-0 bottom-0 bg-purple-500/20 border-r-2 border-purple-400"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-sm text-slate-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(audioData.duration)}</span>
      </div>

      {/* Seek Bar */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          onValueChange={([value]) => handleSeek(value)}
          max={audioData.duration}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => skip(-10)}
          className="text-slate-400 hover:text-white hover:bg-slate-700"
        >
          <SkipBack className="w-5 h-5" />
        </Button>

        <Button
          onClick={() => onPlayingChange(!isPlaying)}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 w-16 h-16 rounded-full"
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
          onClick={() => skip(10)}
          className="text-slate-400 hover:text-white hover:bg-slate-700"
        >
          <SkipForward className="w-5 h-5" />
        </Button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-3">
        <Volume2 className="w-4 h-4 text-slate-400" />
        <Slider
          value={[volume]}
          onValueChange={([value]) => setVolume(value)}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-sm text-slate-400 w-12">{volume}%</span>
      </div>
    </div>
  );
}