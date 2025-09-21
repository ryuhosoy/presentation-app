import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { slides, audio, script, metadata } = await request.json();
    
    if (!slides || !Array.isArray(slides)) {
      return NextResponse.json(
        { error: 'スライドデータが無効です' },
        { status: 400 }
      );
    }

    // Create presentation data structure
    const presentationData = {
      id: `presentation-${Date.now()}`,
      createdAt: new Date().toISOString(),
      slides: slides.map(slide => ({
        id: slide.id,
        imageUrl: slide.imageUrl,
        startTime: slide.startTime,
        duration: slide.duration,
        text: slide.text,
        slideNumber: slide.slideNumber
      })),
      audio: audio ? {
        url: audio.url,
        duration: audio.duration,
        format: audio.format
      } : null,
      script: script || '',
      metadata: {
        totalSlides: slides.length,
        totalDuration: audio?.duration || 0,
        averageSlideTime: audio ? (audio.duration / slides.length) : 0,
        ...metadata
      },
      settings: {
        autoAdvance: true,
        showSlideNumbers: true,
        enableSubtitles: false
      } 
    };

    console.log("presentationData", presentationData);

    // In a real implementation, you might save this to a database
    // For now, we'll return the data for client-side download
    
    return NextResponse.json({
      success: true,
      presentation: presentationData,
      downloadUrl: null, // Would be actual file URL in production
      message: 'プレゼンテーションデータをエクスポートしました'
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { 
        error: 'プレゼンテーションのエクスポートに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}