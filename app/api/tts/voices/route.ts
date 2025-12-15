import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Renderでは NEXT_PUBLIC_ プレフィックスの環境変数がAPI Routesで使えない場合があるため、
// プレフィックスなしの環境変数を使用（両方対応）
const ELEVENLABS_API_KEY = 'sk_a5fd58743122f4e1d79b7d198309d88e32d49d34c8bcffe8';
const ELEVENLABS_VOICES_URL = 'https://api.elevenlabs.io/v1/voices';

export async function GET(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs APIキーが設定されていません' },
        { status: 500 }
      );
    }

    const response = await axios.get(ELEVENLABS_VOICES_URL, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    // 音声情報を整理
    const voices = response.data.voices.map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      description: voice.description,
      labels: voice.labels,
      preview_url: voice.preview_url,
      language: voice.labels?.language || 'en'
    }));

    return NextResponse.json({
      success: true,
      voices: voices
    });

  } catch (error) {
    console.error('Voices fetch error:', error);
    
    let errorMessage = '音声一覧の取得に失敗しました';
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        errorMessage = 'ElevenLabs APIキーが無効です';
      } else if (error.response?.status === 429) {
        errorMessage = 'API利用制限に達しました';
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
