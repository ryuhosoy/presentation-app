// API client for backend communication

export class APIClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async uploadSlides(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload/slides', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'スライドのアップロードに失敗しました');
    }

    return response.json();
  }

  async uploadAudio(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload/audio', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '音声のアップロードに失敗しました');
    }

    return response.json();
  }

  async generateTTS(text: string, options: {
    voice?: string;
    speed?: number;
    language?: string;
  } = {}) {
    const response = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, ...options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'TTS生成に失敗しました');
    }

    return response.json();
  }

  async syncSlides(slides: any[], audioDuration: number, syncMethod = 'auto') {
    const response = await fetch('/api/sync/slides', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slides, audioDuration, syncMethod }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'スライド同期に失敗しました');
    }

    return response.json();
  }

  async generateVideo(slides: any[], audioUrl: string, options: any = {}) {
    const response = await fetch('/api/generate/video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slides, audioUrl, options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '動画生成に失敗しました');
    }

    return response.json();
  }

  async exportPresentation(slides: any[], audio: any, script: string, metadata: any = {}) {
    const response = await fetch('/api/export/presentation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slides, audio, script, metadata }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'エクスポートに失敗しました');
    }

    return response.json();
  }

  // AI駆動のコンテンツ分析
  async analyzeContent(audioUrl: string, slides: any[]) {
    const response = await fetch('/api/analyze/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioUrl, slides }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'コンテンツ分析に失敗しました');
    }

    return response.json();
  }

  // 音声認識のみ
  async transcribeAudio(audioUrl: string) {
    const response = await fetch('/api/analyze/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '音声認識に失敗しました');
    }

    return response.json();
  }

  // スライド内容分析のみ
  async analyzeSlides(slides: any[]) {
    const response = await fetch('/api/analyze/slides', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slides }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'スライド分析に失敗しました');
    }

    return response.json();
  }

  // 利用可能な音声一覧を取得
  async getAvailableVoices() {
    const response = await fetch('/api/tts/voices', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '音声一覧の取得に失敗しました');
    }

    return response.json();
  }

  // AIスクリプト生成
  async generateScript(slides: any[], options: {
    presentationStyle: 'professional' | 'casual' | 'academic' | 'creative';
    targetDuration: number;
    language: 'ja' | 'en';
  }) {
    const response = await fetch('/api/ai/generate-script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slides, ...options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'スクリプト生成に失敗しました');
    }

    return response.json();
  }

  // 自動動画生成
  async generateAutoVideo(slides: any[], script: string, slideScripts: any[], options: {
    presentationStyle: string;
    language: 'ja' | 'en';
    targetDuration: number;
  }) {
    const response = await fetch('/api/ai/generate-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slides, script, slideScripts, ...options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '自動動画生成に失敗しました');
    }

    return response.json();
  }
}

export const apiClient = new APIClient();