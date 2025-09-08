import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AudioAnalysisRequest {
  audioUrl: string;
  slides: Array<{
    id: string;
    text: string;
    imageUrl: string;
  }>;
}

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

interface AnalysisResult {
  audioSegments: AudioSegment[];
  slideAnalysis: SlideAnalysis[];
  relationships: ContentRelationship[];
  optimalTiming: Array<{
    slideId: string;
    startTime: number;
    duration: number;
    confidence: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: AudioAnalysisRequest = await request.json();
    const { audioUrl, slides } = body;

    // 1. 音声認識（Speech-to-Text）
    const audioSegments = await performSpeechRecognition(audioUrl);
    
    // 2. スライド内容分析
    const slideAnalysis = await analyzeSlideContent(slides);
    
    // 3. 自然言語処理による関連性判定
    const relationships = await analyzeContentRelationships(audioSegments, slideAnalysis);
    
    // 4. AIによる最適タイミング提案
    const optimalTiming = await suggestOptimalTiming(audioSegments, slideAnalysis, relationships);

    const result: AnalysisResult = {
      audioSegments,
      slideAnalysis,
      relationships,
      optimalTiming
    };

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Content analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'コンテンツ分析に失敗しました' },
      { status: 500 }
    );
  }
}

// 音声認識の実装
async function performSpeechRecognition(audioUrl: string): Promise<AudioSegment[]> {
  try {
    // OpenAI Whisper APIを使用して音声認識
    const audioFile = await fetch(audioUrl).then(res => res.arrayBuffer());
    
    // 実際の実装では、音声ファイルを適切に処理する必要があります
    // ここではサンプルデータを返します
    return [
      {
        startTime: 0,
        endTime: 15,
        text: "今日は、私たちの新しいプロジェクトについてお話しします。",
        confidence: 0.95,
        keywords: ["プロジェクト", "新規", "説明"],
        sentiment: "neutral"
      },
      {
        startTime: 15,
        endTime: 30,
        text: "このプロジェクトは、革新的な技術を使用して、ユーザー体験を向上させます。",
        confidence: 0.92,
        keywords: ["革新的", "技術", "ユーザー体験", "向上"],
        sentiment: "positive"
      },
      {
        startTime: 30,
        endTime: 45,
        text: "具体的には、AIと機械学習を活用した自動化システムです。",
        confidence: 0.89,
        keywords: ["AI", "機械学習", "自動化", "システム"],
        sentiment: "positive"
      }
    ];
  } catch (error) {
    console.error('Speech recognition error:', error);
    throw new Error('音声認識に失敗しました');
  }
}

// スライド内容分析の実装
async function analyzeSlideContent(slides: any[]): Promise<SlideAnalysis[]> {
  try {
    const analysis: SlideAnalysis[] = [];

    for (const slide of slides) {
      // OpenAI GPTを使用してスライド内容を分析
      const prompt = `
以下のスライド内容を分析してください：
${slide.text}

以下の形式でJSONで回答してください：
{
  "keywords": ["キーワード1", "キーワード2"],
  "mainTopics": ["メイントピック1", "メイントピック2"],
  "complexity": "low|medium|high",
  "estimatedDuration": 秒数
}
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          analysis.push({
            id: slide.id,
            keywords: parsed.keywords || [],
            mainTopics: parsed.mainTopics || [],
            complexity: parsed.complexity || 'medium',
            estimatedDuration: parsed.estimatedDuration || 15
          });
        } catch (parseError) {
          // パースに失敗した場合のフォールバック
          analysis.push({
            id: slide.id,
            keywords: extractKeywords(slide.text),
            mainTopics: [slide.text.substring(0, 50) + '...'],
            complexity: 'medium',
            estimatedDuration: 15
          });
        }
      }
    }

    return analysis;
  } catch (error) {
    console.error('Slide analysis error:', error);
    // エラーが発生した場合のフォールバック
    return slides.map(slide => ({
      id: slide.id,
      keywords: extractKeywords(slide.text),
      mainTopics: [slide.text.substring(0, 50) + '...'],
      complexity: 'medium',
      estimatedDuration: 15
    }));
  }
}

// キーワード抽出のフォールバック実装
function extractKeywords(text: string): string[] {
  const words = text.split(/\s+/);
  const keywords = words.filter(word => 
    word.length > 2 && 
    !['の', 'は', 'が', 'を', 'に', 'へ', 'と', 'から', 'まで'].includes(word)
  );
  return keywords.slice(0, 5);
}

// コンテンツ関連性分析の実装
async function analyzeContentRelationships(
  audioSegments: AudioSegment[], 
  slideAnalysis: SlideAnalysis[]
): Promise<ContentRelationship[]> {
  try {
    const relationships: ContentRelationship[] = [];

    for (const slide of slideAnalysis) {
      let bestMatch: ContentRelationship | null = null;
      let highestScore = 0;

      for (const segment of audioSegments) {
        // キーワードの重複度を計算
        const commonKeywords = slide.keywords.filter(keyword => 
          segment.keywords.includes(keyword)
        );
        
        // テキストの類似度を計算（簡易版）
        const textSimilarity = calculateTextSimilarity(slide.mainTopics.join(' '), segment.text);
        
        // 総合スコアを計算
        const relevanceScore = (commonKeywords.length * 0.4) + (textSimilarity * 0.6);
        
        if (relevanceScore > highestScore) {
          highestScore = relevanceScore;
          bestMatch = {
            slideId: slide.id,
            audioSegments: [segment.text],
            relevanceScore,
            suggestedStartTime: segment.startTime,
            suggestedDuration: Math.max(segment.endTime - segment.startTime, slide.estimatedDuration)
          };
        }
      }

      if (bestMatch && bestMatch.relevanceScore > 0.3) {
        relationships.push(bestMatch);
      }
    }

    return relationships;
  } catch (error) {
    console.error('Relationship analysis error:', error);
    throw new Error('関連性分析に失敗しました');
  }
}

// テキスト類似度計算（簡易版）
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);
  
  return intersection.size / union.size;
}

// 最適タイミング提案の実装
async function suggestOptimalTiming(
  audioSegments: AudioSegment[],
  slideAnalysis: SlideAnalysis[],
  relationships: ContentRelationship[]
): Promise<Array<{
  slideId: string;
  startTime: number;
  duration: number;
  confidence: number;
}>> {
  try {
    const timing: Array<{
      slideId: string;
      startTime: number;
      duration: number;
      confidence: number;
    }> = [];

    // 関連性の高いスライドから順に配置
    const sortedRelationships = relationships.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    let currentTime = 0;
    
    for (const relationship of sortedRelationships) {
      const slide = slideAnalysis.find(s => s.id === relationship.slideId);
      if (!slide) continue;

      // スライドの開始時間を決定
      const startTime = Math.max(currentTime, relationship.suggestedStartTime);
      
      // スライドの表示時間を決定
      const duration = Math.max(
        slide.estimatedDuration,
        relationship.suggestedDuration,
        10 // 最小表示時間
      );

      timing.push({
        slideId: relationship.slideId,
        startTime,
        duration,
        confidence: relationship.relevanceScore
      });

      currentTime = startTime + duration;
    }

    // 残りのスライドを均等に配置
    const remainingSlides = slideAnalysis.filter(slide => 
      !timing.find(t => t.slideId === slide.id)
    );

    const totalRemainingTime = Math.max(0, audioSegments[audioSegments.length - 1]?.endTime - currentTime);
    const timePerSlide = totalRemainingTime / Math.max(remainingSlides.length, 1);

    for (const slide of remainingSlides) {
      timing.push({
        slideId: slide.id,
        startTime: currentTime,
        duration: Math.max(timePerSlide, slide.estimatedDuration),
        confidence: 0.5
      });
      currentTime += Math.max(timePerSlide, slide.estimatedDuration);
    }

    return timing.sort((a, b) => a.startTime - b.startTime);
  } catch (error) {
    console.error('Timing suggestion error:', error);
    throw new Error('タイミング提案に失敗しました');
  }
}
