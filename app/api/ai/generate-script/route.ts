import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

interface SlideContent {
  id: string;
  text: string;
  imageUrl: string;
  slideNumber: number;
}

interface ScriptGenerationRequest {
  slides: SlideContent[];
  presentationStyle: 'professional' | 'casual' | 'academic' | 'creative';
  targetDuration: number; // 目標時間（分）
  language: 'ja' | 'en';
}

interface GeneratedScript {
  script: string;
  estimatedDuration: number;
  slideScripts: Array<{
    slideId: string;
    slideNumber: number;
    script: string;
    duration: number;
  }>;
  presentationTips: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ScriptGenerationRequest = await request.json();
    const { slides, presentationStyle, targetDuration, language } = body;

    if (!slides || slides.length === 0) {
      return NextResponse.json(
        { error: 'スライドが提供されていません' },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI APIキーが設定されていません' },
        { status: 500 }
      );
    }

    // スライド内容を分析してスクリプトを生成
    const generatedScript = await generatePresentationScript(slides, presentationStyle, targetDuration, language);

    return NextResponse.json({
      success: true,
      result: generatedScript
    });

  } catch (error) {
    console.error('Script generation error:', error);
    return NextResponse.json(
      { success: false, error: 'スクリプト生成に失敗しました' },
      { status: 500 }
    );
  }
}

async function generatePresentationScript(
  slides: SlideContent[], 
  presentationStyle: string, 
  targetDuration: number,
  language: string
): Promise<GeneratedScript> {
  try {
    // スライド内容をまとめたプロンプトを作成
    const slidesContent = slides.map(slide => 
      `スライド${slide.slideNumber}: ${slide.text}`
    ).join('\n');

    const systemPrompt = language === 'ja' ? 
      `あなたはプロフェッショナルなプレゼンテーションスクリプト作成の専門家です。
以下のスライド内容を基に、魅力的で分かりやすいプレゼンテーションスクリプトを作成してください。

プレゼンテーションスタイル: ${presentationStyle}
目標時間: ${targetDuration}分
言語: 日本語

各スライドに対して、自然な流れで説明できるスクリプトを作成し、全体として一貫性のあるプレゼンテーションにしてください。
スクリプトは話し言葉で、聞き手が理解しやすい表現を使用してください。` :
      `You are a professional presentation script writer.
Create an engaging and clear presentation script based on the following slide content.

Presentation style: ${presentationStyle}
Target duration: ${targetDuration} minutes
Language: English

For each slide, create a script that flows naturally and maintains consistency throughout the presentation.
Use conversational language that is easy for the audience to understand.`;

    const userPrompt = `以下のスライド内容を基にスクリプトを作成してください：

${slidesContent}

以下の形式でJSONで回答してください：
{
  "script": "全体のスクリプト（段落分けして）",
  "estimatedDuration": 推定時間（分）,
  "slideScripts": [
    {
      "slideId": "スライドID",
      "slideNumber": スライド番号,
      "script": "そのスライド用のスクリプト",
      "duration": 推定時間（秒）
    }
  ],
  "presentationTips": ["プレゼンテーションのコツ1", "コツ2", "コツ3"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('スクリプト生成に失敗しました');
    }

    try {
      const parsed = JSON.parse(content);
      
      // 生成されたスクリプトを検証
      if (!parsed.script || !parsed.slideScripts) {
        throw new Error('生成されたスクリプトの形式が正しくありません');
      }

      return {
        script: parsed.script,
        estimatedDuration: parsed.estimatedDuration || targetDuration,
        slideScripts: parsed.slideScripts.map((slideScript: any) => ({
          slideId: slideScript.slideId,
          slideNumber: slideScript.slideNumber,
          script: slideScript.script,
          duration: slideScript.duration || 15
        })),
        presentationTips: parsed.presentationTips || []
      };

    } catch (parseError) {
      console.error('Script parsing error:', parseError);
      // パースに失敗した場合のフォールバック
      return createFallbackScript(slides, targetDuration, language);
    }

  } catch (error) {
    console.error('OpenAI API error:', error);
    // APIエラー時のフォールバック
    return createFallbackScript(slides, targetDuration, language);
  }
}

function createFallbackScript(slides: SlideContent[], targetDuration: number, language: string): GeneratedScript {
  const totalSlides = slides.length;
  const timePerSlide = (targetDuration * 60) / totalSlides; // 秒単位

  const slideScripts = slides.map(slide => ({
    slideId: slide.id,
    slideNumber: slide.slideNumber,
    script: language === 'ja' ? 
      `このスライドでは、${slide.text}について説明いたします。` :
      `In this slide, I will explain about ${slide.text}.`,
    duration: Math.max(10, Math.min(30, timePerSlide))
  }));

  const script = slideScripts.map(ss => ss.script).join('\n\n');

  return {
    script,
    estimatedDuration: targetDuration,
    slideScripts,
    presentationTips: language === 'ja' ? 
      ['ゆっくりと話す', '重要なポイントを強調する', '聞き手とアイコンタクトを取る'] :
      ['Speak slowly', 'Emphasize key points', 'Maintain eye contact with audience']
  };
}
