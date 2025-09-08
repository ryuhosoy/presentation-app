import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '音声ファイルがアップロードされていません' },
        { status: 400 }
      );
    }

    // Check file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      return NextResponse.json(
        { error: 'サポートされていない音声形式です。MP3、WAV、OGGファイルをアップロードしてください。' },
        { status: 400 }
      );
    }

    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const fileName = `audio-${Date.now()}-${file.name}`;
    const filePath = path.join(uploadsDir, fileName);
    
    await writeFile(filePath, buffer);

    // Get audio metadata (simplified)
    const estimatedDuration = Math.max(10, Math.min(600, file.size / (128 * 1024 / 8)));
    
    return NextResponse.json({
      success: true,
      audio: {
        url: `/uploads/${fileName}`,
        duration: estimatedDuration,
        format: file.type,
        filename: file.name,
        size: file.size
      },
      message: '音声ファイルのアップロードが完了しました'
    });

  } catch (error) {
    console.error('Audio upload error:', error);
    return NextResponse.json(
      { 
        error: '音声ファイルの処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}