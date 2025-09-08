import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import axios from 'axios';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

// ElevenLabs API設定
const NEXT_PUBLIC_ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_NEXT_PUBLIC_ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

interface VideoGenerationRequest {
  slides: Array<{
    id: string;
    text: string;
    imageUrl: string;
    slideNumber: number;
  }>;
  script: string;
  slideScripts: Array<{
    slideId: string;
    slideNumber: number;
    script: string;
    duration: number;
  }>;
  presentationStyle: string;
  language: 'ja' | 'en';
  targetDuration: number;
}

interface VideoGenerationResult {
  videoUrl: string;
  audioUrl: string;
  duration: number;
  slideTimings: Array<{
    slideId: string;
    startTime: number;
    duration: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: VideoGenerationRequest = await request.json();
    const { slides, script, slideScripts, presentationStyle, language, targetDuration } = body;

    if (!slides || slides.length === 0) {
      return NextResponse.json(
        { error: 'スライドが提供されていません' },
        { status: 400 }
      );
    }

    if (!NEXT_PUBLIC_ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs APIキーが設定されていません' },
        { status: 500 }
      );
    }

    // デバッグ情報を追加
    console.log('Received data:', {
      slidesCount: slides.length,
      slideScriptsCount: slideScripts?.length || 0,
      scriptLength: script?.length || 0,
      presentationStyle,
      language,
      targetDuration
    });

    // 1. スクリプトから音声を生成
    const audioResult = await generateAudioFromScript(script, language);
    
    // 2. スライドと音声を同期
    const slideTimings = await synchronizeSlidesWithAudio(slides, slideScripts, audioResult.duration, audioResult.audioPath);
    
    console.log('Generated slide timings:', slideTimings);
    
    // 3. 動画を生成（実際の実装ではffmpegなどを使用）
    const videoResult = await generateVideoFromSlides(slides, audioResult.audioPath, slideTimings);

    return NextResponse.json({
      success: true,
      result: {
        videoUrl: videoResult.videoUrl,
        audioUrl: audioResult.audioUrl,
        duration: audioResult.duration,
        slideTimings: slideTimings
      }
    });

  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { success: false, error: '動画生成に失敗しました' },
      { status: 500 }
    );
  }
}

async function generateAudioFromScript(script: string, language: string) {
  try {
    // 日本語音声ID（ElevenLabs）
    const voiceId = language === 'ja' ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM';

    // ElevenLabs APIで音声生成
    const ttsResponse = await axios.post(
      `${ELEVENLABS_API_URL}/${voiceId}`,
      {
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': NEXT_PUBLIC_ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // 音声ファイルの保存
    const audioFileName = `auto-video-audio-${Date.now()}.mp3`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const audioPath = path.join(uploadsDir, audioFileName);

    await mkdir(uploadsDir, { recursive: true });
    await writeFile(audioPath, ttsResponse.data);

    // 音声の長さを推定
    const estimatedDuration = Math.max(1, script.length * 0.08);

    return {
      audioUrl: `/uploads/${audioFileName}`,
      audioPath: audioPath,
      duration: estimatedDuration
    };

  } catch (error) {
    console.error('Audio generation error:', error);
    throw new Error('音声生成に失敗しました');
  }
}

async function synchronizeSlidesWithAudio(
  slides: any[], 
  slideScripts: any[], 
  totalAudioDuration: number,
  audioPath: string
) {
  try {
    console.log('SynchronizeSlidesWithAudio input:', {
      slidesCount: slides.length,
      slideScriptsCount: slideScripts?.length || 0,
      totalAudioDuration
    });

    const slideTimings = [];
    let currentTime = 0;

    if (!slideScripts || slideScripts.length === 0) {
      console.log('No slideScripts provided, creating default timings');
      // slideScriptsが空の場合、デフォルトのタイミングを作成
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const duration = Math.max(5, Math.min(30, totalAudioDuration / slides.length));
        
        slideTimings.push({
          slideId: slide.id,
          startTime: currentTime,
          duration: duration
        });

        currentTime += duration;
      }
    } else {
      console.log('Processing slideScripts:', slideScripts);
      console.log('Available slides:', slides.map(s => ({ id: s.id, slideNumber: s.slideNumber })));
      
      // 実際に使用される音声ファイルの長さを測定
      const actualAudioDuration = await measureActualAudioDuration(audioPath);
      console.log('Actual audio file duration:', actualAudioDuration);
      
      // 各スライドのスクリプトの実際の音声長を測定
      const slideAudioDurations = await measureSlideAudioDurations(slideScripts);
      console.log('Measured slide audio durations:', slideAudioDurations);
      
      // 実際の音声長に合わせてスライドタイミングを調整
      const totalMeasuredDuration = slideAudioDurations.reduce((sum, duration) => sum + duration, 0);
      const durationRatio = actualAudioDuration / totalMeasuredDuration;
      console.log('Duration ratio (actual/measured):', durationRatio);
      
      // 各スライドの時間を実際の音声長に比例して調整
      const adjustedDurations = slideAudioDurations.map(duration => duration * durationRatio);
      console.log('Adjusted slide durations:', adjustedDurations);
      
      for (let i = 0; i < slideScripts.length; i++) {
        const slideScript = slideScripts[i];
        console.log('Processing slideScript:', slideScript);
        
        // slideIdとslideNumberの両方でマッチングを試行
        let slide = slides.find(s => s.id === slideScript.slideId);
        if (!slide && slideScript.slideNumber) {
          slide = slides.find(s => s.slideNumber === slideScript.slideNumber);
        }
        
        if (!slide) {
          console.log(`No matching slide found for slideScript:`, slideScript);
          continue;
        }

        console.log(`Found matching slide:`, slide);

        // 実際の音声長に調整された時間を使用
        const actualDuration = adjustedDurations[i] || 5; // 測定できない場合は5秒
        
        slideTimings.push({
          slideId: slide.id,
          startTime: currentTime,
          duration: actualDuration
        });

        currentTime += actualDuration;
      }
    }

    // 残りの時間を最後のスライドに追加
    if (slideTimings.length > 0 && currentTime < totalAudioDuration) {
      const remainingTime = totalAudioDuration - currentTime;
      slideTimings[slideTimings.length - 1].duration += remainingTime;
    }

    console.log('Generated slide timings:', slideTimings);
    return slideTimings;

  } catch (error) {
    console.error('Slide synchronization error:', error);
    throw new Error('スライド同期に失敗しました');
  }
}

async function generateVideoFromSlides(
  slides: any[], 
  audioPath: string, 
  slideTimings: any[]
) {
  try {
    const videoFileName = `auto-video-${Date.now()}.mp4`;
    const outputDir = path.join(process.cwd(), 'public', 'output');
    const videoPath = path.join(outputDir, videoFileName);

    await mkdir(outputDir, { recursive: true });

    // 複数スライドの自動切り替わりを実装
    if (slideTimings.length === 0) {
      throw new Error('スライドタイミングが設定されていません');
    }

    console.log('Processing multiple slides for automatic transitions...');
    
    // 各スライドの画像ファイルを準備
    const slideImagePaths: string[] = [];
    const slideDurations: number[] = [];
    
    for (let i = 0; i < slideTimings.length; i++) {
      const timing = slideTimings[i];
      const slide = slides.find(s => s.id === timing.slideId);
      if (!slide) continue;
      
      let imagePath: string;
      
      if (slide.imageUrl.startsWith('data:image/')) {
        // base64画像の場合、一時ファイルとして保存
        const imageFileName = `slide-${slide.id}-${i}-${Date.now()}.png`;
        const imageDir = path.join(process.cwd(), 'public', 'temp');
        await mkdir(imageDir, { recursive: true });
        
        // base64データをデコードしてファイルに保存
        const base64Data = slide.imageUrl.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const tempImagePath = path.join(imageDir, imageFileName);
        await writeFile(tempImagePath, imageBuffer as any);
        
        imagePath = tempImagePath;
        console.log(`Saved base64 image ${i} to:`, imagePath);
      } else {
        // 通常のファイルパスの場合
        imagePath = path.join(process.cwd(), 'public', slide.imageUrl.replace(/^\//, ''));
      }
      
      slideImagePaths.push(imagePath);
      slideDurations.push(timing.duration);
    }
    
    // より確実な複数スライドのffmpegコマンドを構築
    let inputArgs = '';
    let filterComplex = '';
    
    // 音声ファイルを最初の入力として追加
    inputArgs += ` -i "${audioPath}"`;
    
    // 各スライドの入力とフィルターを追加（開始時間を考慮）
    for (let i = 0; i < slideImagePaths.length; i++) {
      const timing = slideTimings[i];
      inputArgs += ` -loop 1 -t ${timing.duration} -i "${slideImagePaths[i]}"`;
      
      // スケーリングフィルター（各スライドを1920x1080に調整）
      filterComplex += `${i > 0 ? ';' : ''}[${i + 1}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[v${i + 1}]`;
    }
    
    // スライドを時間軸に沿って連結するフィルター
    let concatFilter = '';
    for (let i = 0; i < slideImagePaths.length; i++) {
      concatFilter += `[v${i + 1}]`;
    }
    concatFilter += `concat=n=${slideImagePaths.length}:v=1:a=0[outv]`;
    
    // 最終的なffmpegコマンド（concat方式）
    const ffmpegCommand = `ffmpeg -y${inputArgs} -filter_complex "${filterComplex};${concatFilter}" -map "[outv]" -map 0:a -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p "${videoPath}"`;

    console.log('Generated FFmpeg command:', ffmpegCommand);
    console.log('Audio path:', audioPath);
    console.log('Slide image paths:', slideImagePaths);
    console.log('Slide durations:', slideDurations);
    console.log('Total slides:', slideImagePaths.length);
    console.log('Filter complex:', filterComplex);
    console.log('Concat filter:', concatFilter);
    
    // 各スライドの詳細情報をログ出力
    for (let i = 0; i < slideTimings.length; i++) {
      const timing = slideTimings[i];
      const slide = slides.find(s => s.id === timing.slideId);
      console.log(`Slide ${i}: ID=${timing.slideId}, StartTime=${timing.startTime}s, Duration=${timing.duration}s, EndTime=${timing.startTime + timing.duration}s, Image=${slideImagePaths[i]}`);
    }

    try {
      await execAsync(ffmpegCommand);
      console.log('Video generated successfully');
    } catch (ffmpegError: any) {
      console.error('FFmpeg error:', ffmpegError);
      console.error('FFmpeg stderr:', ffmpegError.stderr);
      
      // ffmpegが利用できない場合のフォールバック
      // スライド画像を結合したシンプルな動画を作成
      await createFallbackVideo(slides, audioPath, slideTimings, videoPath);
    }

    // 一時ファイルをクリーンアップ
    for (let i = 0; i < slideImagePaths.length; i++) {
      const slide = slides.find(s => s.id === slideTimings[i].slideId);
      if (slide && slide.imageUrl.startsWith('data:image/')) {
        try {
          const fs = require('fs');
          if (fs.existsSync(slideImagePaths[i])) {
            fs.unlinkSync(slideImagePaths[i]);
            console.log(`Cleaned up temporary image file ${i}:`, slideImagePaths[i]);
          }
        } catch (cleanupError) {
          console.warn(`Failed to cleanup temporary file ${i}:`, cleanupError);
        }
      }
    }

    return {
      videoUrl: `/output/${videoFileName}`,
      videoPath: videoPath
    };

  } catch (error) {
    console.error('Video generation error:', error);
    throw new Error('動画生成に失敗しました');
  }
}

// 実際に使用される音声ファイルの長さを測定する関数
async function measureActualAudioDuration(audioPath: string): Promise<number> {
  try {
    console.log('Measuring actual audio file duration:', audioPath);
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const ffprobeCommand = `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
    const { stdout } = await execAsync(ffprobeCommand);
    const duration = parseFloat(stdout.trim()) || 0;
    
    console.log('Actual audio file duration:', duration, 'seconds');
    return duration;
  } catch (error) {
    console.error('Error measuring actual audio duration:', error);
    return 0;
  }
}

// 各スライドのスクリプトの実際の音声長を測定する関数
async function measureSlideAudioDurations(slideScripts: any[]): Promise<number[]> {
  try {
    console.log('Measuring actual audio durations for each slide script...');
    const durations: number[] = [];
    
    for (let i = 0; i < slideScripts.length; i++) {
      const slideScript = slideScripts[i];
      console.log(`Measuring duration for slide ${i}:`, slideScript.script?.substring(0, 100) + '...');
      
      try {
        // ElevenLabs APIを使用して各スライドのスクリプトを音声に変換
        const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || ''
          },
          body: JSON.stringify({
            text: slideScript.script,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }
        
        // 音声データを取得
        const audioBuffer = await response.arrayBuffer();
        const audioArray = new Uint8Array(audioBuffer);
        
        // 音声ファイルを一時保存して長さを測定
        const tempAudioPath = path.join(process.cwd(), 'public', 'temp', `temp-audio-${i}-${Date.now()}.mp3`);
        await mkdir(path.dirname(tempAudioPath), { recursive: true });
        await writeFile(tempAudioPath, audioArray as any);
        
        // ffprobeを使用して音声の長さを測定
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const ffprobeCommand = `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempAudioPath}"`;
        const { stdout } = await execAsync(ffprobeCommand);
        const duration = parseFloat(stdout.trim()) || 5;
        
        // 一時ファイルを削除
        try {
          const fs = require('fs');
          if (fs.existsSync(tempAudioPath)) {
            fs.unlinkSync(tempAudioPath);
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp audio file:', cleanupError);
        }
        
        durations.push(duration);
        console.log(`Slide ${i} actual duration: ${duration}s`);
        
      } catch (error) {
        console.warn(`Failed to measure duration for slide ${i}:`, error);
        // エラーの場合は推定値を使用
        const estimatedDuration = slideScript.duration || 5;
        durations.push(Math.max(5, Math.min(30, estimatedDuration)));
      }
    }
    
    return durations;
  } catch (error) {
    console.error('Error measuring slide audio durations:', error);
    // エラーの場合は推定値を使用
    return slideScripts.map(script => script.duration || 5);
  }
}

// フォールバック用の動画生成（ffmpegが利用できない場合）
async function createFallbackVideo(
  slides: any[], 
  audioPath: string, 
  slideTimings: any[], 
  videoPath: string
) {
  try {
    // 音声ファイルの長さを取得
    const audioDuration = slideTimings.reduce((total, timing) => total + timing.duration, 0);
    
    // シンプルなフォールバック - 最初のスライドのみ
    if (slideTimings.length === 0) {
      throw new Error('スライドタイミングが設定されていません');
    }

    const firstTiming = slideTimings[0];
    const firstSlide = slides.find(s => s.id === firstTiming.slideId);
    if (!firstSlide) {
      throw new Error('最初のスライドが見つかりません');
    }

    // base64画像URLを実際のファイルとして保存
    let slideImagePath: string;
    
    if (firstSlide.imageUrl.startsWith('data:image/')) {
      // base64画像の場合、一時ファイルとして保存
      const imageFileName = `slide-${firstSlide.id}-${Date.now()}.png`;
      const imageDir = path.join(process.cwd(), 'public', 'temp');
      await mkdir(imageDir, { recursive: true });
      
      // base64データをデコードしてファイルに保存
      const base64Data = firstSlide.imageUrl.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const imagePath = path.join(imageDir, imageFileName);
      await writeFile(imagePath, imageBuffer as any);
      
      slideImagePath = imagePath;
      console.log('Saved base64 image to:', slideImagePath);
    } else {
      // 通常のファイルパスの場合
      slideImagePath = path.join(process.cwd(), 'public', firstSlide.imageUrl.replace(/^\//, ''));
    }
    
    // シンプルなffmpegコマンド
    const ffmpegCommand = `ffmpeg -y -i "${audioPath}" -loop 1 -t ${firstTiming.duration} -i "${slideImagePath}" -filter_complex "[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[scaled]" -map "[scaled]" -map 0:a -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p "${videoPath}"`;

    await execAsync(ffmpegCommand);
    console.log('Fallback video generated successfully');

    // 一時ファイルをクリーンアップ
    if (firstSlide.imageUrl.startsWith('data:image/')) {
      try {
        const fs = require('fs');
        if (fs.existsSync(slideImagePath)) {
          fs.unlinkSync(slideImagePath);
          console.log('Cleaned up temporary image file:', slideImagePath);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary file:', cleanupError);
      }
    }

  } catch (fallbackError) {
    console.error('Fallback video generation failed:', fallbackError);
    // 最後の手段として、プレースホルダーファイルを作成
    await writeFile(videoPath, 'video generation failed');
  }
}
