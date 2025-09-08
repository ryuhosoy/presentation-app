'use client';

import React, { useState } from 'react';
import { Brain, Mic, FileText, Link, Clock, TrendingUp, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AudioSegment {
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface SlideAnalysis {
  id: string;
  keywords: string[];
  mainTopics: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedDuration: number;
}

interface ContentRelationship {
  slideId: string;
  audioSegments: string[];
  relevanceScore: number;
  suggestedStartTime: number;
  suggestedDuration: number;
}

interface OptimalTiming {
  slideId: string;
  startTime: number;
  duration: number;
  confidence: number;
}

interface ContentAnalysisProps {
  audioSegments: AudioSegment[];
  slideAnalysis: SlideAnalysis[];
  relationships: ContentRelationship[];
  optimalTiming: OptimalTiming[];
  onApplyTiming: (timing: OptimalTiming[]) => void;
  onSegmentClick: (segment: AudioSegment) => void;
}

export function ContentAnalysis({
  audioSegments,
  slideAnalysis,
  relationships,
  optimalTiming,
  onApplyTiming,
  onSegmentClick
}: ContentAnalysisProps) {
  const [selectedTab, setSelectedTab] = useState('overview');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'negative': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">AI Content Analysis</h3>
              <p className="text-sm text-slate-400">音声とスライドの関連性をAIが分析</p>
            </div>
          </div>
          
          <Button
            onClick={() => onApplyTiming(optimalTiming)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Apply AI Timing
          </Button>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600">
              <TrendingUp className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="audio" className="data-[state=active]:bg-purple-600">
              <Mic className="w-4 h-4 mr-2" />
              Audio Analysis
            </TabsTrigger>
            <TabsTrigger value="slides" className="data-[state=active]:bg-purple-600">
              <FileText className="w-4 h-4 mr-2" />
              Slide Analysis
            </TabsTrigger>
            <TabsTrigger value="timing" className="data-[state=active]:bg-purple-600">
              <Clock className="w-4 h-4 mr-2" />
              Optimal Timing
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Audio Summary */}
              <Card className="p-4 bg-slate-700/50 border-slate-600">
                <div className="flex items-center space-x-3 mb-3">
                  <Mic className="w-5 h-5 text-blue-400" />
                  <h4 className="font-medium text-white">Audio Analysis</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Segments:</span>
                    <span className="text-white">{audioSegments.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Duration:</span>
                    <span className="text-white">
                      {formatTime(audioSegments[audioSegments.length - 1]?.endTime || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avg. Confidence:</span>
                    <span className="text-white">
                      {Math.round(
                        (audioSegments.reduce((sum, seg) => sum + seg.confidence, 0) / audioSegments.length) * 100
                      )}%
                    </span>
                  </div>
                </div>
              </Card>

              {/* Slide Summary */}
              <Card className="p-4 bg-slate-700/50 border-slate-600">
                <div className="flex items-center space-x-3 mb-3">
                  <FileText className="w-5 h-5 text-green-400" />
                  <h4 className="font-medium text-white">Slide Analysis</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Slides:</span>
                    <span className="text-white">{slideAnalysis.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Complexity:</span>
                    <span className="text-white">
                      {slideAnalysis.filter(s => s.complexity === 'high').length} High
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Duration:</span>
                    <span className="text-white">
                      {Math.round(slideAnalysis.reduce((sum, s) => sum + s.estimatedDuration, 0))}s
                    </span>
                  </div>
                </div>
              </Card>

              {/* Relationship Summary */}
              <Card className="p-4 bg-slate-700/50 border-slate-600">
                <div className="flex items-center space-x-3 mb-3">
                  <Link className="w-5 h-5 text-purple-400" />
                  <h4 className="font-medium text-white">Content Relationships</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Strong Matches:</span>
                    <span className="text-white">
                      {relationships.filter(r => r.relevanceScore > 0.7).length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Medium Matches:</span>
                    <span className="text-white">
                      {relationships.filter(r => r.relevanceScore > 0.4 && r.relevanceScore <= 0.7).length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avg. Relevance:</span>
                    <span className="text-white">
                      {Math.round(
                        (relationships.reduce((sum, r) => sum + r.relevanceScore, 0) / relationships.length) * 100
                      )}%
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* AI Recommendations */}
            <Card className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
              <div className="flex items-center space-x-3 mb-3">
                <Brain className="w-5 h-5 text-purple-400" />
                <h4 className="font-medium text-white">AI Recommendations</h4>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>音声とスライドの関連性を基に最適なタイミングを提案</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>スライドの複雑さに応じた表示時間を自動調整</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>自然な流れでプレゼンテーションを構成</span>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Audio Analysis Tab */}
          <TabsContent value="audio" className="mt-6">
            <div className="space-y-4">
              {audioSegments.map((segment, index) => (
                <Card 
                  key={index} 
                  className="p-4 bg-slate-700/50 border-slate-600 hover:border-slate-500 transition-colors cursor-pointer"
                  onClick={() => onSegmentClick(segment)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge variant="outline" className={getSentimentColor(segment.sentiment)}>
                          {segment.sentiment}
                        </Badge>
                        <span className="text-sm text-slate-400">
                          {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                        </span>
                        <span className={`text-sm font-medium ${getConfidenceColor(segment.confidence)}`}>
                          {Math.round(segment.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-white mb-3">{segment.text}</p>
                      <div className="flex flex-wrap gap-2">
                        {segment.keywords.map((keyword, idx) => (
                          <Badge key={idx} variant="secondary" className="bg-slate-600 text-slate-300">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="ml-4">
                      <Progress value={segment.confidence * 100} className="w-20 h-2" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Slide Analysis Tab */}
          <TabsContent value="slides" className="mt-6">
            <div className="space-y-4">
              {slideAnalysis.map((slide, index) => (
                <Card key={slide.id} className="p-4 bg-slate-700/50 border-slate-600">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-white">Slide {index + 1}</h4>
                        <Badge variant="outline" className={getComplexityColor(slide.complexity)}>
                          {slide.complexity} complexity
                        </Badge>
                        <span className="text-sm text-slate-400">
                          {slide.estimatedDuration}s estimated
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm text-slate-400">Main Topics:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {slide.mainTopics.map((topic, idx) => (
                              <Badge key={idx} variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-slate-400">Keywords:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {slide.keywords.map((keyword, idx) => (
                              <Badge key={idx} variant="secondary" className="bg-slate-600 text-slate-300">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Optimal Timing Tab */}
          <TabsContent value="timing" className="mt-6">
            <div className="space-y-4">
              {optimalTiming.map((timing, index) => {
                const slide = slideAnalysis.find(s => s.id === timing.slideId);
                const relationship = relationships.find(r => r.slideId === timing.slideId);
                
                return (
                  <Card key={timing.slideId} className="p-4 bg-slate-700/50 border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-white">
                            Slide {slideAnalysis.findIndex(s => s.id === timing.slideId) + 1}
                          </h4>
                          <Badge variant="outline" className={getComplexityColor(slide?.complexity || 'medium')}>
                            {slide?.complexity || 'medium'}
                          </Badge>
                          <span className={`text-sm font-medium ${getConfidenceColor(timing.confidence)}`}>
                            {Math.round(timing.confidence * 100)}% confidence
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-400">Start Time:</span>
                            <div className="text-white font-medium">{formatTime(timing.startTime)}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Duration:</span>
                            <div className="text-white font-medium">{formatTime(timing.duration)}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Relevance:</span>
                            <div className="text-white font-medium">
                              {relationship ? Math.round(relationship.relevanceScore * 100) : 0}%
                            </div>
                          </div>
                        </div>
                        {relationship && (
                          <div className="mt-3 p-3 bg-slate-600/30 rounded-lg">
                            <div className="text-sm text-slate-400 mb-1">Related Audio:</div>
                            <div className="text-sm text-slate-300">
                              {relationship.audioSegments[0]?.substring(0, 100)}...
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
