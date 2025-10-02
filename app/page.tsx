'use client';

import { useState, useEffect } from 'react';
import { Upload, Play, Pause, Download, Mic, MicOff, Volume2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/FileUpload';
import { SlideTimeline } from '@/components/SlideTimeline';
import { AudioControls } from '@/components/AudioControls';
import { PresentationPlayer } from '@/components/PresentationPlayer';
import { ContentAnalysis } from '@/components/ContentAnalysis';
import { parsePowerPointFile } from '@/lib/pptx-parser';
import { apiClient } from '@/lib/api-client';

interface Slide {
  id: string;
  imageUrl: string;
  startTime: number;
  duration: number;
  text?: string;
  slideNumber?: number; // スライド番号を追加
}

interface AudioData {
  url: string;
  duration: number;
  blob?: Blob;
}

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [scriptText, setScriptText] = useState('');
  const [processingStep, setProcessingStep] = useState<string>('');
  const [isProcessingSlides, setIsProcessingSlides] = useState(false);
  
  // AI分析関連の状態
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // TTS関連の状態
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('default');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  
  // AI自動生成関連の状態
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<any>(null);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  const [presentationStyle, setPresentationStyle] = useState<'professional' | 'casual' | 'academic' | 'creative'>('professional');
  const [targetDuration, setTargetDuration] = useState<number>(5);
  // 言語は日本語に固定
  const language: 'ja' = 'ja';

  const handleSlidesUpload = async (files: File[]) => {
    setIsProcessingSlides(true);
    setProcessingStep('Processing presentation files with PDF conversion...');
    
    try {
      const allSlides: Slide[] = [];
      
      for (const file of files) {
        if (file.name.endsWith('.pptx')) {
          // Use PDF conversion approach for PowerPoint files
          console.log("file in handleSlidesUpload", file);
          setProcessingStep(`Converting ${file.name} to PDF and extracting slides...`);
          const slideData = await parsePowerPointFile(file);
          // スライド番号を追加
          const slidesWithNumbers = slideData.map((slide: any, index: number) => ({
            ...slide,
            slideNumber: index + 1
          }));
          allSlides.push(...slidesWithNumbers);
        } else if (file.type.startsWith('image/')) {
          // Handle individual image files
          const imageSlide: Slide = {
            id: `slide-${allSlides.length}`,
            imageUrl: URL.createObjectURL(file),
            startTime: allSlides.length * 10,
            duration: 10,
            text: `Slide ${allSlides.length + 1} content...`,
            slideNumber: allSlides.length + 1
          };
          allSlides.push(imageSlide);
        }
      }
      
      setSlides(allSlides);
      setProcessingStep(`${allSlides.length}枚のスライドを処理しました`);
    } catch (error) {
      console.error('Error processing slides:', error);
      setProcessingStep('Error processing files. Please try again.');
      setTimeout(() => setProcessingStep(''), 3000);
    } finally {
      setIsProcessingSlides(false);
    }
  };

  const handleAudioUpload = (file: File) => {
    setProcessingStep('音声ファイルを処理中...');
    
    apiClient.uploadAudio(file)
      .then(response => {
        if (response.success) {
          setAudioData({
            url: response.audio.url,
            duration: response.audio.duration,
            blob: file
          });
          setProcessingStep('音声ファイルの処理が完了しました');
        }
      })
      .catch(error => {
        console.error('Audio upload error:', error);
        setProcessingStep('音声ファイルの処理に失敗しました');
      })
      .finally(() => {
        setTimeout(() => setProcessingStep(''), 3000);
      });
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // In a real implementation, this would handle actual recording
  };

  const generateTTS = async () => {
    if (!scriptText.trim()) return;
    
    setProcessingStep('Generating speech...');
    
    try {
      const response = await apiClient.generateTTS(scriptText, {
        voice: selectedVoice,
        speed: 0.9,
        language: 'ja-JP'
      });
      
      if (response.success) {
        setAudioData({
          url: response.audio.url,
          duration: response.audio.duration
        });
        setProcessingStep('TTS音声の生成が完了しました');
      }
    } catch (error) {
      console.error('TTS generation error:', error);
      setProcessingStep('TTS生成に失敗しました');
    } finally {
      setTimeout(() => setProcessingStep(''), 3000);
    }
  };

  // 利用可能な音声一覧を取得
  const loadAvailableVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const response = await apiClient.getAvailableVoices();
      if (response.success) {
        setAvailableVoices(response.voices);
        // 日本語音声があれば最初のものを選択
        const japaneseVoice = response.voices.find((voice: any) => 
          voice.language === 'ja' || voice.labels?.language === 'ja'
        );
        if (japaneseVoice) {
          setSelectedVoice(japaneseVoice.id);
        }
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  // AIスクリプト生成
  const generateAIScript = async () => {
    if (slides.length === 0) return;
    
    setIsGeneratingScript(true);
    setProcessingStep('AIがスクリプトを生成中...');
    
    try {
      const response = await apiClient.generateScript(slides, {
        presentationStyle,
        targetDuration,
        language
      });
      
      if (response.success) {
        console.log('AI Script generation result:', response.result);
        console.log('Generated slideScripts:', response.result.slideScripts);
        console.log('Current slides:', slides.map(s => ({ id: s.id, slideNumber: s.slideNumber })));
        
        // slideScriptsのslideIdを実際のスライドのidに修正
        const correctedSlideScripts = response.result.slideScripts.map((script: any, index: number) => ({
          ...script,
          slideId: slides[index]?.id || script.slideId
        }));
        
        const correctedResult = {
          ...response.result,
          slideScripts: correctedSlideScripts
        };
        
        console.log('Corrected result:', correctedResult);
        setGeneratedScript(correctedResult);
        setScriptText(correctedResult.script);
        setProcessingStep('AIスクリプトの生成が完了しました');
      }
    } catch (error) {
      console.error('Script generation error:', error);
      setProcessingStep('スクリプト生成に失敗しました');
    } finally {
      setIsGeneratingScript(false);
      setTimeout(() => setProcessingStep(''), 3000);
    }
  };

  // 自動動画生成
  const generateAutoVideo = async () => {
    if (!generatedScript || slides.length === 0) return;
    
    // デバッグ情報を追加
    console.log('generateAutoVideo input:', {
      slidesCount: slides.length,
      generatedScript: generatedScript,
      slideScripts: generatedScript.slideScripts,
      script: generatedScript.script
    });
    
    console.log('各スライドのスクリプト詳細:');
    generatedScript.slideScripts.forEach((slideScript: any, index: number) => {
      console.log(`スライド${index + 1}: "${slideScript.script}" (${slideScript.duration}秒)`);
    });
    
    setIsGeneratingVideo(true);
    setProcessingStep('自動動画を生成中...');
    
    try {
      // ステップ1: 各スライドの音声生成
      setProcessingStep('ステップ1/4: 各スライドのAI音声を生成中...');
      const response = await apiClient.generateAutoVideo(
        slides,
        generatedScript.script,
        generatedScript.slideScripts || [], // 空配列のフォールバック
        {
          presentationStyle,
          language,
          targetDuration
        }
      );
      
      if (response.success) {
        setProcessingStep('ステップ2/4: 各スライドの音声を結合中...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 同期処理のシミュレーション
        
        setProcessingStep('ステップ3/4: 動画をレンダリング中...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // レンダリング処理のシミュレーション
        
        setProcessingStep('ステップ4/4: 動画を最終化中...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 最終化処理のシミュレーション
        
        setProcessingStep('🎉 動画生成が完了しました！');
        
        // 生成された動画の情報を保存
        setGeneratedVideo({
          videoUrl: response.result.videoUrl,
          audioUrl: response.result.audioUrl,
          duration: response.result.duration,
          slideTimings: response.result.slideTimings
        });
      }
    } catch (error) {
      console.error('Auto video generation error:', error);
      
      let errorMessage = '❌ 自動動画生成に失敗しました';
      
      // エラーの詳細情報を取得
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      
      setProcessingStep(errorMessage);
      
      // ユーザー向けの詳細なエラー情報を表示
      setTimeout(() => {
        if (error instanceof Error && error.message.includes('APIキー')) {
          alert('🔑 APIキーの設定が必要です\n\n解決方法:\n1. .env.localファイルを作成\n2. ElevenLabs APIキーを設定\n3. OpenAI APIキーを設定\n\n詳細はREADME.mdをご確認ください');
        } else {
          alert('❌ 動画生成でエラーが発生しました\n\nコンソールログを確認してください');
        }
      }, 1000);
      
    } finally {
      setIsGeneratingVideo(false);
      setTimeout(() => setProcessingStep(''), 8000); // エラーメッセージを長めに表示
    }
  };

  // AI駆動のコンテンツ分析
  const analyzeContent = async () => {
    if (!audioData || slides.length === 0) return;
    
    setIsAnalyzing(true);
    setProcessingStep('AIがコンテンツを分析中...');
    
    try {
      const response = await apiClient.analyzeContent(audioData.url, slides);
      
      if (response.success) {
        setAnalysisResult(response.result);
        setShowAnalysis(true);
        setProcessingStep('AI分析が完了しました');
        
        // AI分析結果を基にスライドのタイミングを更新
        const updatedSlides = slides.map(slide => {
          const timing = response.result.optimalTiming.find((t: any) => t.slideId === slide.id);
          if (timing) {
            return {
              ...slide,
              startTime: timing.startTime,
              duration: timing.duration
            };
          }
          return slide;
        });
        
        setSlides(updatedSlides);
      }
    } catch (error) {
      console.error('Content analysis error:', error);
      setProcessingStep('AI分析に失敗しました');
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setProcessingStep(''), 3000);
    }
  };

  // AI分析結果を適用
  const applyAITiming = (timing: any[]) => {
    const updatedSlides = slides.map(slide => {
      const timingData = timing.find(t => t.slideId === slide.id);
      if (timingData) {
        return {
          ...slide,
          startTime: timingData.startTime,
          duration: timingData.duration
        };
      }
      return slide;
    });
    
    setSlides(updatedSlides);
    setProcessingStep('AIタイミングが適用されました');
    setTimeout(() => setProcessingStep(''), 3000);
  };

  // 音声セグメントクリック時の処理
  const handleSegmentClick = (segment: any) => {
    // 音声セグメントの時間に合わせてスライドを表示
    const slideIndex = slides.findIndex(slide => 
      segment.startTime >= slide.startTime && 
      segment.startTime < slide.startTime + slide.duration
    );
    
    if (slideIndex !== -1) {
      setCurrentSlide(slideIndex);
    }
  };

  const exportPresentation = async () => {
    if (!slides.length) return;
    
    setProcessingStep('プレゼンテーションをエクスポート中...');
    
    try {
      const response = await apiClient.exportPresentation(
        slides, 
        audioData, 
        scriptText,
        {
          totalDuration: audioData?.duration || 0,
          slideCount: slides.length
        }
      );
      
      if (response.success) {
        // Download the presentation data
        const blob = new Blob([JSON.stringify(response.presentation, null, 2)], {
          type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `presentation-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        setProcessingStep('エクスポートが完了しました');
      }
    } catch (error) {
      console.error('Export error:', error);
      setProcessingStep('エクスポートに失敗しました');
    } finally {
      setTimeout(() => setProcessingStep(''), 3000);
    }
  };

  const generateVideo = async () => {
    if (!slides.length || !audioData) return;
    
    setProcessingStep('動画を生成中...');
    
    try {
      const response = await apiClient.generateVideo(slides, audioData.url, {
        resolution: '1920x1080',
        fps: 30,
        format: 'mp4',
        quality: 'high'
      });
      
      if (response.success) {
        setProcessingStep('動画生成が完了しました');
        // In production, this would trigger download or show download link
        alert(`動画が生成されました: ${response.video.filename}`);
      }
    } catch (error) {
      console.error('Video generation error:', error);
      setProcessingStep('動画生成に失敗しました');
    } finally {
      setTimeout(() => setProcessingStep(''), 3000);
    }
  };

  useEffect(() => {
    loadAvailableVoices();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            PresentationFlow
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Transform your PowerPoint presentations into engaging automated videos with synchronized audio and smooth slide transitions
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Upload & Settings */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4">Upload Materials</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Slide Images
                  </label>
                  <FileUpload
                    onFilesUpload={handleSlidesUpload}
                    acceptedTypes=".pptx,.pdf,image/*"
                    multiple={true}
                    placeholder="Upload PowerPoint (.pptx), PDF, or images"
                    fileType="slides"
                  />
                  {slides.length > 0 && !isProcessingSlides && (
                    <p className="text-sm text-green-400 mt-2">
                      ✓ {slides.length} slides uploaded
                    </p>
                  )}
                  {isProcessingSlides && (
                    <p className="text-sm text-blue-400 mt-2 animate-pulse">
                      🔄 Processing presentation...
                    </p>
                  )}
                </div>


              </div>
            </Card>

            {/* Action Buttons */}
            {slides.length > 0 && audioData && (
              <Card className="p-6 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
                <div className="space-y-3">
                  <Button
                    onClick={analyzeContent}
                    disabled={isAnalyzing}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    {isAnalyzing ? 'AI分析中...' : 'AI Content Analysis'}
                  </Button>
                  
                  <Button
                    onClick={generateVideo}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Generate Video
                  </Button>
                  
                  <Button
                    onClick={exportPresentation}
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
              </Card>
            )}

            {/* AI Auto Generation Section */}
            {slides.length > 0 && (
              <Card className="p-6 bg-gradient-to-r from-purple-800/30 to-blue-800/30 border-purple-600/30 backdrop-blur-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">AI Auto Generation</h3>
                </div>
                <p className="text-sm text-slate-300 mb-4">
                  PowerPointスライドから自動的にスクリプトを生成し、動画を作成します
                </p>

                <div className="space-y-4">
                  {/* 設定オプション */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        プレゼンテーションスタイル
                      </label>
                      <select
                        value={presentationStyle}
                        onChange={(e) => setPresentationStyle(e.target.value as any)}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                      >
                        <option value="professional">プロフェッショナル</option>
                        <option value="casual">カジュアル</option>
                        <option value="academic">アカデミック</option>
                        <option value="creative">クリエイティブ</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        目標時間（分）
                      </label>
                      <select
                        value={targetDuration}
                        onChange={(e) => setTargetDuration(Number(e.target.value))}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                      >
                        <option value={3}>3分</option>
                        <option value={5}>5分</option>
                        <option value={10}>10分</option>
                        <option value={15}>15分</option>
                        <option value={20}>20分</option>
                      </select>
                    </div>
                  </div>

                  {/* メインアクションボタン */}
                  <div className="space-y-3">
                    <Button
                      onClick={generateAIScript}
                      disabled={isGeneratingScript}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      {isGeneratingScript ? 'スクリプト生成中...' : 'AIスクリプト生成'}
                    </Button>

                    {generatedScript && (
                      <Button
                        onClick={generateAutoVideo}
                        disabled={isGeneratingVideo}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {isGeneratingVideo ? '動画生成中...' : '自動動画生成'}
                      </Button>
                    )}
                  </div>

                  {/* 生成されたスクリプトの表示 */}
                  {generatedScript && (
                    <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                      <h4 className="font-medium text-white mb-2">生成されたスクリプト</h4>
                      <div className="space-y-2">
                        <div className="text-sm text-slate-300">
                          <span className="text-slate-400">推定時間:</span> {generatedScript.estimatedDuration}分
                        </div>
                        <div className="text-sm text-slate-300">
                          <span className="text-slate-400">スライド数:</span> {generatedScript.slideScripts.length}枚
                        </div>
                        <div className="text-sm text-slate-300">
                          <span className="text-slate-400">プレゼンテーションのコツ:</span>
                        </div>
                        <ul className="list-disc list-inside text-sm text-slate-300 ml-4">
                          {generatedScript.presentationTips.map((tip: string, index: number) => (
                            <li key={index}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* 生成された動画の表示 */}
                  {generatedVideo && (
                    <div className="mt-4 p-4 bg-green-700/20 rounded-lg border border-green-600/30">
                      <h4 className="font-medium text-white mb-3 flex items-center">
                        <Play className="w-4 h-4 mr-2 text-green-400" />
                        生成された動画
                      </h4>
                      <div className="space-y-3">
                        <div className="text-sm text-slate-300">
                          <span className="text-slate-400">動画時間:</span> {Math.round(generatedVideo.duration)}秒
                        </div>
                        
                        {/* 動画プレイヤー */}
                        <div className="relative">
                          <video 
                            controls 
                            className="w-full rounded-lg border border-slate-600"
                            poster="/placeholder-video.jpg"
                          >
                            <source src={generatedVideo.videoUrl} type="video/mp4" />
                            お使いのブラウザは動画再生に対応していません。
                          </video>
                        </div>
                        
                        {/* ダウンロードボタン */}
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = generatedVideo.videoUrl;
                              link.download = `presentation-${Date.now()}.mp4`;
                              link.click();
                            }}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            動画をダウンロード
                          </Button>
                          
                          <Button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = generatedVideo.audioUrl;
                              link.download = `presentation-audio-${Date.now()}.mp3`;
                              link.click();
                            }}
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            <Volume2 className="w-4 h-4 mr-2" />
                            音声のみ
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Center Panel - Timeline & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {processingStep && (
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-blue-400">{processingStep}</span>
                </div>
              </Card>
            )}

            {/* AI Content Analysis */}
            {showAnalysis && analysisResult && (
              <ContentAnalysis
                audioSegments={analysisResult.audioSegments}
                slideAnalysis={analysisResult.slideAnalysis}
                relationships={analysisResult.relationships}
                optimalTiming={analysisResult.optimalTiming}
                onApplyTiming={applyAITiming}
                onSegmentClick={handleSegmentClick}
              />
            )}

            {/* Presentation Player */}
            {slides.length > 0 && (
              <PresentationPlayer
                slides={slides}
                audioData={audioData}
                currentSlide={currentSlide}
                onSlideChange={setCurrentSlide}
                isPlaying={isPlaying}
                onPlayingChange={setIsPlaying}
              />
            )}

            {/* Timeline */}
            {slides.length > 0 && audioData && (
              <Card className="p-6 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-white mb-4">Timeline & Synchronization</h3>
                <SlideTimeline
                  slides={slides}
                  audioData={audioData}
                  onSlidesUpdate={setSlides}
                  currentTime={0}
                />
              </Card>
            )}

            {/* Audio Controls */}
            {audioData && (
              <Card className="p-6 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-white mb-4">Audio Controls</h3>
                <AudioControls
                  audioData={audioData}
                  isPlaying={isPlaying}
                  onPlayingChange={setIsPlaying}
                />
              </Card>
            )}

            {/* Getting Started */}
            {slides.length === 0 && !audioData && (
              <Card className="p-12 bg-slate-800/30 border-slate-700 backdrop-blur-sm text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    Get Started
                  </h3>
                  <p className="text-slate-400 mb-6">
                    PowerPointファイルと音声をアップロードして、自動化されたプレゼンテーションを作成します。
                  </p>
                  <div className="space-y-2 text-sm text-slate-500">
                    <p>1. PowerPointファイル(.pptx)またはスライド画像をアップロード</p>
                    <p>2. 音声を追加（アップロード、録音、またはテキストから生成）</p>
                    <p>3. タイミングを同期してプレゼンテーションをプレビュー</p>
                    <p>4. 自動プレゼンテーションをエクスポートまたは動画生成</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        {(slides.length > 0 || audioData) && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-slate-800/30 border-slate-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{slides.length}</div>
                <div className="text-sm text-slate-400">Slides</div>
              </div>
            </Card>
            <Card className="p-4 bg-slate-800/30 border-slate-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {audioData ? Math.round(audioData.duration) : 0}s
                </div>
                <div className="text-sm text-slate-400">Audio Duration</div>
              </div>
            </Card>
            <Card className="p-4 bg-slate-800/30 border-slate-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {slides.length > 0 && audioData ? Math.round(audioData.duration / slides.length) : 0}s
                </div>
                <div className="text-sm text-slate-400">Avg. per Slide</div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}