import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ElevenLabs API設定
// const NEXT_PUBLIC_ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
const NEXT_PUBLIC_ELEVENLABS_API_KEY = "sk_7e9347471e093ae4cca19715fa0b4c1134f16f20a1288a3b";
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
  console.log('[generate-video] API呼び出し開始');
  
  try {
    const body: VideoGenerationRequest = await request.json();
    const { slides, script, slideScripts, presentationStyle, language, targetDuration } = body;

    console.log('[generate-video] リクエストデータ:', {
      slidesCount: slides?.length || 0,
      scriptLength: script?.length || 0,
      slideScriptsCount: slideScripts?.length || 0,
      presentationStyle,
      language,
      targetDuration
    });

    if (!slides || slides.length === 0) {
      console.error('[generate-video] スライドが提供されていません');
      return NextResponse.json(
        { error: 'スライドが提供されていません' },
        { status: 400 }
      );
    }

    if (!script || script.trim().length === 0) {
      console.error('[generate-video] スクリプトが提供されていません');
      return NextResponse.json(
        { error: 'スクリプトが提供されていません' },
        { status: 400 }
      );
    }

    // ElevenLabs APIキーの警告（エラーではなく警告に変更）
    if (!NEXT_PUBLIC_ELEVENLABS_API_KEY) {
      console.warn('[generate-video] ElevenLabs APIキーが設定されていません。ダミー音声を使用します。');
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

    // 1. 各スライドのスクリプトから個別に音声を生成
    console.log('[generate-video] ステップ1: 各スライドの音声生成開始');
    const audioResult = await generateAudioFromSlideScripts(slideScripts, language);
    console.log('[generate-video] ステップ1完了: 音声生成完了', {
      audioUrl: audioResult.audioUrl,
      duration: audioResult.duration
    });
    
    // 2. スライドと音声を同期（実際の音声時間を使用）
    console.log('[generate-video] ステップ2: スライド同期開始');
    const slideTimings = audioResult.slideAudioDurations 
      ? createSlideTimingsFromActualAudioDurations(slideScripts, audioResult.slideAudioDurations)
      : createSlideTimingsFromScripts(slideScripts, audioResult.duration);
    console.log('[generate-video] ステップ2完了: スライド同期完了', slideTimings);
    
    // 3. 動画を生成（実際の実装ではffmpegなどを使用）
    console.log('[generate-video] ステップ3: 動画生成開始');
    const videoResult = await generateVideoFromSlides(slides, audioResult.audioPath, slideTimings);
    console.log('[generate-video] ステップ3完了: 動画生成完了', {
      videoUrl: videoResult.videoUrl
    });

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
    console.error('[generate-video] 動画生成エラー:', error);
    console.error('[generate-video] エラースタック:', error instanceof Error ? error.stack : 'No stack');
    
    let errorMessage = '動画生成に失敗しました';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function generateAudioFromSlideScripts(slideScripts: any[], language: string) {
  console.log('[generateAudioFromSlideScripts] 開始');
  console.log('[generateAudioFromSlideScripts] スライドスクリプト数:', slideScripts?.length || 0);
  console.log('[generateAudioFromSlideScripts] 言語:', language);
  console.log('[generateAudioFromSlideScripts] APIキー設定状況:', NEXT_PUBLIC_ELEVENLABS_API_KEY ? '設定済み' : '未設定');

  if (NEXT_PUBLIC_ELEVENLABS_API_KEY) {
    console.log('NEXT_PUBLIC_ELEVENLABS_API_KEY:', NEXT_PUBLIC_ELEVENLABS_API_KEY);
  }
  
  if (!slideScripts || slideScripts.length === 0) {
    console.error('[generateAudioFromSlideScripts] スライドスクリプトが提供されていません');
    throw new Error('スライドスクリプトが提供されていません');
  }
  
  try {
    // APIキーの確認
    if (!NEXT_PUBLIC_ELEVENLABS_API_KEY) {
      console.warn('[generateAudioFromSlideScripts] ElevenLabs APIキーが設定されていません。ダミー音声を生成します。');
      return await generateDummyAudioFromSlideScripts(slideScripts);
    }

    // 各スライドの音声を個別に生成
    const slideAudioPaths: string[] = [];
    const slideAudioDurations: number[] = [];
    
    for (let i = 0; i < slideScripts.length; i++) {
      const slideScript = slideScripts[i];
      console.log(`[generateAudioFromSlideScripts] スライド${i + 1}の音声生成: "${slideScript.script}"`);
      
      const slideAudioResult = await generateSingleSlideAudio(slideScript.script, language, i);
      slideAudioPaths.push(slideAudioResult.audioPath);
      slideAudioDurations.push(slideAudioResult.duration);
      
      console.log(`[generateAudioFromSlideScripts] スライド${i + 1}完了: ${slideAudioResult.duration}秒`);
    }
    
    // 各スライドの音声を結合
    console.log('[generateAudioFromSlideScripts] 音声ファイルを結合中...');
    const combinedAudioResult = await combineSlideAudios(slideAudioPaths, slideAudioDurations);
    
    // 一時ファイルをクリーンアップ
    await cleanupTempFiles(slideAudioPaths);
    
    console.log('[generateAudioFromSlideScripts] 完了:', combinedAudioResult);
    return combinedAudioResult;
    
  } catch (error) {
    console.error('[generateAudioFromSlideScripts] 音声生成エラー:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('[generateAudioFromSlideScripts] Axiosエラー詳細:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      if (error.response?.status === 401) {
        console.error('[generateAudioFromSlideScripts] 認証エラー: APIキーが無効です');
        return await generateDummyAudioFromSlideScripts(slideScripts);
      }
    }
    
    console.warn('[generateAudioFromSlideScripts] エラーが発生したため、ダミー音声を生成します');
    return await generateDummyAudioFromSlideScripts(slideScripts);
  }
}

async function generateAudioFromScript(script: string, language: string) {
  console.log('[generateAudioFromScript] 開始');
  console.log('[generateAudioFromScript] スクリプト長:', script?.length || 0);
  console.log('[generateAudioFromScript] 言語:', language);
  console.log('[generateAudioFromScript] APIキー設定状況:', NEXT_PUBLIC_ELEVENLABS_API_KEY ? '設定済み' : '未設定');
  
  try {
    // APIキーの確認
    if (!NEXT_PUBLIC_ELEVENLABS_API_KEY) {
      console.warn('[generateAudioFromScript] ElevenLabs APIキーが設定されていません。ダミー音声を生成します。');
      return await generateDummyAudio(script);
    }

    // 日本語音声ID（ElevenLabs）
    const voiceId = language === 'ja' ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM';
    console.log('[generateAudioFromScript] 使用音声ID:', voiceId);

    // ElevenLabs APIで音声生成
    console.log('[generateAudioFromScript] ElevenLabs API呼び出し開始');
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
        responseType: 'arraybuffer',
        timeout: 30000 // 30秒のタイムアウト
      }
    );

    console.log('[generateAudioFromScript] ElevenLabs API呼び出し完了, ステータス:', ttsResponse.status);

    // 音声ファイルの保存
    const audioFileName = `auto-video-audio-${Date.now()}.mp3`;
    const uploadsDir = process.env.VERCEL 
    ? path.join('/tmp', 'uploads')
    : path.join(process.cwd(), 'public', 'uploads');
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
    console.error('[generateAudioFromScript] 音声生成エラー:', error);
    
    // Axiosエラーの詳細情報
    if (axios.isAxiosError(error)) {
      console.error('[generateAudioFromScript] Axiosエラー詳細:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      if (error.response?.status === 401) {
        console.error('[generateAudioFromScript] 認証エラー: APIキーが無効です');
        // APIキーが無効な場合はダミー音声にフォールバック
        return await generateDummyAudio(script);
      }
    }
    
    // その他のエラーの場合もダミー音声にフォールバック
    console.warn('[generateAudioFromScript] エラーが発生したため、ダミー音声を生成します');
    return await generateDummyAudio(script);
  }
}

// ダミー音声生成関数
async function generateDummyAudio(script: string) {
  console.log('[generateDummyAudio] ダミー音声生成開始');
  
  // スクリプトの長さから推定時間を計算（日本語: 1文字あたり0.15秒）
  const estimatedDuration = Math.max(5, script.length * 0.15);
  console.log('[generateDummyAudio] 推定時間:', estimatedDuration, '秒');
  
  const audioFileName = `dummy-audio-${Date.now()}.mp3`;
  const uploadsDir = process.env.VERCEL 
    ? path.join('/tmp', 'uploads')
    : path.join(process.cwd(), 'public', 'uploads');
  const audioPath = path.join(uploadsDir, audioFileName);
  
  await mkdir(uploadsDir, { recursive: true });
  
  try {
    // FFmpegで無音の音声ファイルを生成
    const silenceCommand = `ffmpeg -y -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" -t ${estimatedDuration} -c:a mp3 -b:a 128k "${audioPath}"`;
    console.log('[generateDummyAudio] FFmpeg command:', silenceCommand);
    
    await execAsync(silenceCommand);
    console.log('[generateDummyAudio] 無音音声ファイル生成完了');
    
  } catch (ffmpegError) {
    console.warn('[generateDummyAudio] FFmpegが利用できません。プレースホルダーファイルを作成');
    // FFmpegが利用できない場合はプレースホルダーファイルを作成
    await writeFile(audioPath, 'dummy audio content');
  }
  
  return {
    audioUrl: `/uploads/${audioFileName}`,
    audioPath: audioPath,
    duration: estimatedDuration
  };
}

async function generateSingleSlideAudio(script: string, language: string, slideIndex: number) {
  console.log(`[generateSingleSlideAudio] スライド${slideIndex + 1}の音声生成開始`);
  
  if (!script || script.trim().length === 0) {
    console.warn(`[generateSingleSlideAudio] スライド${slideIndex + 1}のスクリプトが空です`);
    // 空のスクリプトの場合は短いダミー音声を生成
    return await generateDummyAudio(`スライド ${slideIndex + 1}`);
  }
  
  try {
    // 日本語音声ID（ElevenLabs）
    const voiceId = language === 'ja' ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM';
    console.log(`[generateSingleSlideAudio] スライド${slideIndex + 1}使用音声ID:`, voiceId);

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
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    console.log(`[generateSingleSlideAudio] スライド${slideIndex + 1}API呼び出し完了, ステータス:`, ttsResponse.status);

    // 音声ファイルの保存
    const audioFileName = `slide-audio-${slideIndex + 1}-${Date.now()}.mp3`;
    const uploadsDir = process.env.VERCEL 
    ? path.join('/tmp', 'uploads')
    : path.join(process.cwd(), 'public', 'uploads');
    const audioPath = path.join(uploadsDir, audioFileName);

    await mkdir(uploadsDir, { recursive: true });
    await writeFile(audioPath, ttsResponse.data);

    // 音声ファイルの実際の長さを取得
    const actualDuration = await getAudioDuration(audioPath);
    console.log(`[generateSingleSlideAudio] スライド${slideIndex + 1}音声ファイル保存完了:`, audioPath);
    console.log(`[generateSingleSlideAudio] スライド${slideIndex + 1}実際の音声時間:`, actualDuration, '秒');

    return {
      audioUrl: `/uploads/${audioFileName}`,
      audioPath: audioPath,
      duration: actualDuration
    };

  } catch (error) {
    console.error(`[generateSingleSlideAudio] スライド${slideIndex + 1}音声生成エラー:`, error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('ElevenLabs APIキーが無効です');
      }
    }
    
    // エラーの場合はダミー音声を生成
    console.warn(`[generateSingleSlideAudio] スライド${slideIndex + 1}ダミー音声を生成します`);
    return await generateDummyAudio(script);
  }
}

async function combineSlideAudios(slideAudioPaths: string[], slideAudioDurations: number[]) {
  console.log('[combineSlideAudios] 音声結合開始');
  console.log('[combineSlideAudios] 結合する音声ファイル数:', slideAudioPaths.length);
  
  const combinedAudioFileName = `combined-audio-${Date.now()}.mp3`;
  const uploadsDir = process.env.VERCEL 
    ? path.join('/tmp', 'uploads')
    : path.join(process.cwd(), 'public', 'uploads');
  const combinedAudioPath = path.join(uploadsDir, combinedAudioFileName);
  
  await mkdir(uploadsDir, { recursive: true });
  
  try {
    if (slideAudioPaths.length === 1) {
      // 1つのファイルの場合はそのままコピー
      console.log('[combineSlideAudios] 単一ファイルのためコピーします');
      const fs = require('fs');
      fs.copyFileSync(slideAudioPaths[0], combinedAudioPath);
    } else {
      // 複数ファイルの場合はFFmpegで結合
      console.log('[combineSlideAudios] FFmpegで複数ファイルを結合します');
      
      // 結合リストファイルを作成
      const tempDir = process.env.VERCEL 
        ? path.join('/tmp', 'temp')
        : path.join(process.cwd(), 'public', 'temp');
      const concatListPath = path.join(tempDir, `audio-concat-list-${Date.now()}.txt`);
      await mkdir(tempDir, { recursive: true });
      
      const concatListContent = slideAudioPaths.map(audioPath => `file '${audioPath}'`).join('\n');
      await writeFile(concatListPath, concatListContent);
      
      // FFmpegで音声を結合
      const concatCommand = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${combinedAudioPath}"`;
      console.log('[combineSlideAudios] FFmpeg結合コマンド:', concatCommand);
      
      await execAsync(concatCommand);
      
      // 一時ファイルをクリーンアップ
      const fs = require('fs');
      if (fs.existsSync(concatListPath)) {
        fs.unlinkSync(concatListPath);
      }
    }
    
    // 結合された音声ファイルの実際の長さを取得
    const actualTotalDuration = await getAudioDuration(combinedAudioPath);
    const calculatedTotalDuration = slideAudioDurations.reduce((sum, duration) => sum + duration, 0);
    
    console.log('[combineSlideAudios] 音声結合完了');
    console.log('[combineSlideAudios] 計算上の合計時間:', calculatedTotalDuration, '秒');
    console.log('[combineSlideAudios] 実際の合計時間:', actualTotalDuration, '秒');
    
    return {
      audioUrl: `/uploads/${combinedAudioFileName}`,
      audioPath: combinedAudioPath,
      duration: actualTotalDuration,
      slideAudioDurations: slideAudioDurations // 各スライドの実際の音声時間も返す
    };
    
  } catch (error) {
    console.error('[combineSlideAudios] 音声結合エラー:', error);
    
    // フォールバック: 最初の音声ファイルを使用
    if (slideAudioPaths.length > 0) {
      console.warn('[combineSlideAudios] フォールバック: 最初の音声ファイルを使用');
      const fs = require('fs');
      fs.copyFileSync(slideAudioPaths[0], combinedAudioPath);
      
      return {
        audioUrl: `/uploads/${combinedAudioFileName}`,
        audioPath: combinedAudioPath,
        duration: slideAudioDurations[0] || 10,
        slideAudioDurations: slideAudioDurations
      };
    }
    
    throw new Error('音声結合に失敗しました');
  }
}

async function generateDummyAudioFromSlideScripts(slideScripts: any[]) {
  console.log('[generateDummyAudioFromSlideScripts] ダミー音声生成開始');
  
  // 各スライドの個別ダミー音声を生成
  const slideAudioPaths: string[] = [];
  const slideAudioDurations: number[] = [];
  
  for (let i = 0; i < slideScripts.length; i++) {
    const slideScript = slideScripts[i];
    const script = slideScript.script || `スライド ${i + 1}`;
    
    console.log(`[generateDummyAudioFromSlideScripts] スライド${i + 1}のダミー音声生成: "${script}"`);
    
    const dummyAudioResult = await generateDummyAudio(script);
    slideAudioPaths.push(dummyAudioResult.audioPath);
    slideAudioDurations.push(dummyAudioResult.duration);
  }
  
  // 各スライドの音声を結合
  const combinedAudioResult = await combineSlideAudios(slideAudioPaths, slideAudioDurations);
  
  // 一時ファイルをクリーンアップ
  await cleanupTempFiles(slideAudioPaths);
  
  return combinedAudioResult;
}

async function getAudioDuration(audioPath: string): Promise<number> {
  console.log('[getAudioDuration] 音声ファイルの長さを取得中:', audioPath);
  
  try {
    // FFprobeを使って音声ファイルの実際の長さを取得
    const probeCommand = `ffprobe -v quiet -print_format json -show_format "${audioPath}"`;
    console.log('[getAudioDuration] FFprobeコマンド:', probeCommand);
    
    const { stdout } = await execAsync(probeCommand);
    const probeResult = JSON.parse(stdout);
    
    const duration = parseFloat(probeResult.format?.duration || '0');
    console.log('[getAudioDuration] 取得した音声時間:', duration, '秒');
    
    if (duration <= 0) {
      console.warn('[getAudioDuration] 無効な音声時間が検出されました。推定値を使用します');
      return 5; // フォールバック値
    }
    
    return duration;
    
  } catch (error) {
    console.error('[getAudioDuration] 音声時間取得エラー:', error);
    
    // フォールバック: ファイルサイズから推定
    try {
      const fs = require('fs');
      const stats = fs.statSync(audioPath);
      const fileSizeKB = stats.size / 1024;
      
      // MP3の平均ビットレート128kbpsを仮定して推定
      // 128kbps = 16KB/秒
      const estimatedDuration = Math.max(1, fileSizeKB / 16);
      
      console.log('[getAudioDuration] ファイルサイズから推定:', estimatedDuration, '秒');
      return estimatedDuration;
      
    } catch (fallbackError) {
      console.error('[getAudioDuration] フォールバック推定も失敗:', fallbackError);
      return 5; // 最終フォールバック
    }
  }
}

function createSlideTimingsFromActualAudioDurations(slideScripts: any[], slideAudioDurations: number[]) {
  console.log('[createSlideTimingsFromActualAudioDurations] スライドタイミング作成開始');
  console.log('[createSlideTimingsFromActualAudioDurations] slideScripts数:', slideScripts.length);
  console.log('[createSlideTimingsFromActualAudioDurations] 実際の音声時間:', slideAudioDurations);
  
  const slideTimings: any[] = [];
  let currentTime = 0;
  
  for (let i = 0; i < slideScripts.length; i++) {
    const slideScript = slideScripts[i];
    
    // 実際の音声時間を使用（フォールバックとして推定値も用意）
    let slideDuration = slideAudioDurations[i];
    if (!slideDuration || slideDuration <= 0) {
      // 実際の音声時間が取得できない場合のフォールバック
      slideDuration = slideScript.duration || Math.max(3, (slideScript.script?.length || 10) * 0.15);
      console.warn(`[createSlideTimingsFromActualAudioDurations] スライド${i + 1}: 実際の音声時間が取得できないため推定値を使用: ${slideDuration}秒`);
    }
    
    const timing = {
      slideId: slideScript.slideId,
      slideNumber: slideScript.slideNumber || (i + 1),
      startTime: currentTime,
      duration: slideDuration
    };
    
    slideTimings.push(timing);
    currentTime += slideDuration;
    
    console.log(`[createSlideTimingsFromActualAudioDurations] スライド${i + 1}: 開始=${timing.startTime}秒, 実際の音声時間=${timing.duration}秒, 終了=${currentTime}秒`);
  }
  
  console.log('[createSlideTimingsFromActualAudioDurations] 完了:', slideTimings);
  return slideTimings;
}

function createSlideTimingsFromScripts(slideScripts: any[], totalAudioDuration: number) {
  console.log('[createSlideTimingsFromScripts] スライドタイミング作成開始（推定値ベース）');
  console.log('[createSlideTimingsFromScripts] slideScripts数:', slideScripts.length);
  console.log('[createSlideTimingsFromScripts] 総音声時間:', totalAudioDuration, '秒');
  
  const slideTimings: any[] = [];
  let currentTime = 0;
  
  for (let i = 0; i < slideScripts.length; i++) {
    const slideScript = slideScripts[i];
    
    // 各スライドの時間を計算（slideScriptのdurationまたは推定値を使用）
    let slideDuration = slideScript.duration;
    if (!slideDuration) {
      // durationが設定されていない場合は文字数から推定
      slideDuration = Math.max(3, (slideScript.script?.length || 10) * 0.15);
    }
    
    // 最後のスライドの場合、残り時間を調整
    if (i === slideScripts.length - 1) {
      const remainingTime = totalAudioDuration - currentTime;
      if (remainingTime > 0) {
        slideDuration = Math.max(slideDuration, remainingTime);
      }
    }
    
    const timing = {
      slideId: slideScript.slideId,
      slideNumber: slideScript.slideNumber || (i + 1),
      startTime: currentTime,
      duration: slideDuration
    };
    
    slideTimings.push(timing);
    currentTime += slideDuration;
    
    console.log(`[createSlideTimingsFromScripts] スライド${i + 1}: 開始=${timing.startTime}秒, 時間=${timing.duration}秒, 終了=${currentTime}秒`);
  }
  
  console.log('[createSlideTimingsFromScripts] 完了:', slideTimings);
  return slideTimings;
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
    const outputDir = process.env.VERCEL 
      ? path.join('/tmp', 'output')
      : path.join(process.cwd(), 'public', 'output');
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
        const imageDir = process.env.VERCEL 
          ? path.join('/tmp', 'temp')
          : path.join(process.cwd(), 'public', 'temp');
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
        imagePath = process.env.VERCEL 
          ? path.join('/tmp', slide.imageUrl.replace(/^\//, ''))
          : path.join(process.cwd(), 'public', slide.imageUrl.replace(/^\//, ''));
      }
      
      slideImagePaths.push(imagePath);
      slideDurations.push(timing.duration);
    }
    
    // シンプルで確実なffmpegコマンドを構築
    console.log('Building FFmpeg command for multiple slides...');
    
    // 各スライドの動画を個別に生成してから結合する方式
    const tempVideoPaths: string[] = [];
    
    try {
      // 各スライドの個別動画を生成
      for (let i = 0; i < slideImagePaths.length; i++) {
        const timing = slideTimings[i];
        console.log('Processing slide timing for slide in generateVideoFromSlides:', i, timing);
        const tempDir = process.env.VERCEL 
          ? path.join('/tmp', 'temp')
          : path.join(process.cwd(), 'public', 'temp');
        const tempVideoPath = path.join(tempDir, `temp-slide-${i}-${Date.now()}.mp4`);
        tempVideoPaths.push(tempVideoPath);
        
        // 個別スライドの動画生成コマンド
        const slideVideoCommand = `ffmpeg -y -loop 1 -i "${slideImagePaths[i]}" -t ${timing.duration} -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p -r 30 "${tempVideoPath}"`;
        
        console.log(`Generating slide ${i} video:`, slideVideoCommand);
        await execAsync(slideVideoCommand);
        console.log(`Slide ${i} video generated:`, tempVideoPath);
      }
      
      // スライド動画を結合するためのファイルリストを作成
      const tempDir = process.env.VERCEL 
        ? path.join('/tmp', 'temp')
        : path.join(process.cwd(), 'public', 'temp');
      const concatListPath = path.join(tempDir, `concat-list-${Date.now()}.txt`);
      const concatListContent = tempVideoPaths.map(path => `file '${path}'`).join('\n');
      await writeFile(concatListPath, concatListContent);
      
      // 音声なしの動画を結合
      const combinedVideoPath = path.join(tempDir, `combined-video-${Date.now()}.mp4`);
      const concatCommand = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${combinedVideoPath}"`;
      
      console.log('Concatenating slide videos:', concatCommand);
      await execAsync(concatCommand);
      console.log('Combined video created:', combinedVideoPath);
      
      // 結合された動画に音声を追加
      const finalCommand = `ffmpeg -y -i "${combinedVideoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${videoPath}"`;
      
      console.log('Adding audio to final video:', finalCommand);
      await execAsync(finalCommand);
      console.log('Final video with audio created:', videoPath);
      
      // 一時ファイルをクリーンアップ
      await cleanupTempFiles([...tempVideoPaths, combinedVideoPath, concatListPath]);
      
    } catch (ffmpegError: any) {
      console.error('FFmpeg error:', ffmpegError);
      console.error('FFmpeg stderr:', ffmpegError.stderr);
      
      // 一時ファイルをクリーンアップ
      await cleanupTempFiles(tempVideoPaths);
      
      // ffmpegが利用できない場合のフォールバック
      await createFallbackVideo(slides, audioPath, slideTimings, videoPath);
    }

    // 各スライドの詳細情報をログ出力
    for (let i = 0; i < slideTimings.length; i++) {
      const timing = slideTimings[i];
      const slide = slides.find(s => s.id === timing.slideId);
      console.log(`Slide ${i}: ID=${timing.slideId}, StartTime=${timing.startTime}s, Duration=${timing.duration}s, EndTime=${timing.startTime + timing.duration}s, Image=${slideImagePaths[i]}`);
    }

    // 一時画像ファイルをクリーンアップ
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
        const tempDir = process.env.VERCEL 
          ? path.join('/tmp', 'temp')
          : path.join(process.cwd(), 'public', 'temp');
        const tempAudioPath = path.join(tempDir, `temp-audio-${i}-${Date.now()}.mp3`);
        await mkdir(tempDir, { recursive: true });
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

// 一時ファイルのクリーンアップ関数
async function cleanupTempFiles(filePaths: string[]) {
  console.log('Cleaning up temporary files:', filePaths);
  
  for (const filePath of filePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up temporary file:', filePath);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary file:', filePath, cleanupError);
    }
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
      const imageDir = process.env.VERCEL 
        ? path.join('/tmp', 'temp')
        : path.join(process.cwd(), 'public', 'temp');
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
      slideImagePath = process.env.VERCEL 
        ? path.join('/tmp', firstSlide.imageUrl.replace(/^\//, ''))
        : path.join(process.cwd(), 'public', firstSlide.imageUrl.replace(/^\//, ''));
    }
    
    try {
      // シンプルなffmpegコマンド
      const ffmpegCommand = `ffmpeg -y -i "${audioPath}" -loop 1 -t ${firstTiming.duration} -i "${slideImagePath}" -filter_complex "[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[scaled]" -map "[scaled]" -map 0:a -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p "${videoPath}"`;

      console.log('Fallback FFmpeg command:', ffmpegCommand);
      await execAsync(ffmpegCommand);
      console.log('Fallback video generated successfully');
    } catch (fallbackFFmpegError) {
      console.error('Fallback FFmpeg failed:', fallbackFFmpegError);
      // 最後の手段として、プレースホルダーファイルを作成
      await writeFile(videoPath, 'video generation failed');
    }

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
