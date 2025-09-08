import { NextRequest, NextResponse } from 'next/server';

interface Slide {
  id: string;
  imageUrl: string;
  startTime: number;
  duration: number;
  text?: string;
  slideNumber?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { slides, audioDuration, syncMethod = 'auto' } = await request.json();
    
    if (!slides || !Array.isArray(slides)) {
      return NextResponse.json(
        { error: 'スライドデータが無効です' },
        { status: 400 }
      );
    }

    if (!audioDuration || audioDuration <= 0) {
      return NextResponse.json(
        { error: '音声の長さが無効です' },
        { status: 400 }
      );
    }

    let syncedSlides: Slide[];

    switch (syncMethod) {
      case 'auto':
        // Auto-sync: distribute slides evenly across audio duration
        const slideInterval = audioDuration / slides.length;
        syncedSlides = slides.map((slide, index) => ({
          ...slide,
          startTime: index * slideInterval,
          duration: slideInterval
        }));
        break;

      case 'text-based':
        // Text-based sync: estimate timing based on text length
        const totalTextLength = slides.reduce((sum, slide) => 
          sum + (slide.text?.length || 0), 0
        );
        
        let currentTime = 0;
        syncedSlides = slides.map(slide => {
          const textRatio = (slide.text?.length || 0) / totalTextLength;
          const duration = Math.max(3, audioDuration * textRatio); // Minimum 3 seconds per slide
          
          const syncedSlide = {
            ...slide,
            startTime: currentTime,
            duration
          };
          
          currentTime += duration;
          return syncedSlide;
        });
        break;

      case 'equal':
        // Equal timing for all slides
        const equalDuration = audioDuration / slides.length;
        syncedSlides = slides.map((slide, index) => ({
          ...slide,
          startTime: index * equalDuration,
          duration: equalDuration
        }));
        break;

      default:
        return NextResponse.json(
          { error: '無効な同期方法です' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      slides: syncedSlides,
      syncMethod,
      totalDuration: audioDuration,
      message: `${syncMethod}方式でスライドを同期しました`
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { 
        error: 'スライドの同期に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}