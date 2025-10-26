import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// ElevenLabs API設定
// const NEXT_PUBLIC_ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
const NEXT_PUBLIC_ELEVENLABS_API_KEY = "sk_7e9347471e093ae4cca19715fa0b4c1134f16f20a1288a3b";
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// 利用可能な音声ID（ElevenLabsのデフォルト音声）
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel (英語)
const JAPANESE_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam (日本語対応)

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'default', speed = 1.0, language = 'ja-JP' } = await request.json();
    
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'テキストが入力されていません' },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'テキストが長すぎます。5000文字以内で入力してください。' },
        { status: 400 }
      );
    }

    if (!NEXT_PUBLIC_ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs APIキーが設定されていません' },
        { status: 500 }
      );
    }

    // 音声IDの選択
    const voiceId = language === 'ja-JP' ? JAPANESE_VOICE_ID : DEFAULT_VOICE_ID;

    // ElevenLabs APIにリクエスト
    const ttsResponse = await axios.post(
      `${ELEVENLABS_API_URL}/${voiceId}`,
      {
        text: text,
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
    const audioFileName = `tts-${Date.now()}.mp3`;
    const uploadsDir = process.env.VERCEL 
      ? path.join('/tmp', 'uploads')
      : path.join(process.cwd(), 'public', 'uploads');
    const audioPath = path.join(uploadsDir, audioFileName);

    // ディレクトリが存在しない場合は作成
    await mkdir(uploadsDir, { recursive: true });

    // 音声ファイルを保存
    await writeFile(audioPath, ttsResponse.data);

    // 音声の長さを推定（文字数から概算）
    const estimatedDuration = Math.max(1, text.length * 0.08);

    return NextResponse.json({
      success: true,
      audio: {
        url: `/uploads/${audioFileName}`,
        duration: estimatedDuration,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        voice,
        speed,
        language,
        generatedAt: new Date().toISOString(),
        voiceId: voiceId
      },
      message: 'TTS音声の生成が完了しました'
    });

  } catch (error) {
    console.error('TTS generation error:', error);
    
    // ElevenLabs APIエラーの詳細を取得
    let errorMessage = 'TTS音声の生成に失敗しました';
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        errorMessage = 'ElevenLabs APIキーが無効です';
      } else if (error.response?.status === 429) {
        errorMessage = 'API利用制限に達しました。しばらく待ってから再試行してください';
      } else if (error.response?.data) {
        try {
          const errorData = JSON.parse(error.response.data.toString());
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `API エラー: ${error.response.status}`;
        }
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}