import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import ConvertApi from 'convertapi';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // ConvertAPIの設定
    const convertApiSecret = process.env.CONVERTAPI_SECRET;
    if (!convertApiSecret) {
      console.error('CONVERTAPI_SECRET not found in environment variables');
      return NextResponse.json(
        { error: 'ConvertAPI configuration missing' },
        { status: 500 }
      );
    }

    // ConvertAPIクライアントを初期化
    const convertApi = new ConvertApi(convertApiSecret);

    // 一時ディレクトリを作成
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // ファイルを一時保存
    const tempFilePath = path.join(tempDir, `temp-${Date.now()}.pptx`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer as any);
    
    try {
      console.log('Starting ConvertAPI PDF conversion...');
      console.log('Input file size:', buffer.length, 'bytes');
      
      // ConvertAPIを使用してPDF変換
      const result = await convertApi.convert('pdf', { File: tempFilePath }, 'pptx');
      
      console.log('ConvertAPI conversion successful');
      
      // 公開ディレクトリに保存
      const publicDir = path.join(process.cwd(), 'public', 'converted');
      await fs.mkdir(publicDir, { recursive: true });
      
      // ConvertAPIの結果を直接保存
      await result.saveFiles(publicDir);
      
      // 保存されたPDFファイルのパスを取得（ConvertAPIが生成したファイル名を使用）
      const files = await fs.readdir(publicDir);
      const pdfFile = files.find(file => file.endsWith('.pdf'));
      const publicPdfPath = path.join(publicDir, pdfFile || `converted-${Date.now()}.pdf`);
      
      // 一時ファイルを削除
      await fs.unlink(tempFilePath);
      
      console.log('PDF conversion completed successfully with ConvertAPI');
      return NextResponse.json({
        success: true,
        pdfUrl: `/converted/${path.basename(publicPdfPath)}`,
        method: 'convertapi'
      });
      
    } catch (conversionError) {
      console.error('ConvertAPI conversion error:', conversionError);
      
      // ConvertAPIが失敗した場合のフォールバック
      console.log('Using fallback method - returning original PPTX file');
      
      const publicDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(publicDir, { recursive: true });
      
      const publicFilePath = path.join(publicDir, `fallback-${Date.now()}.pptx`);
      await fs.writeFile(publicFilePath, buffer as any);
      
      // 一時ファイルを削除
      await fs.unlink(tempFilePath);
      
      return NextResponse.json({
        success: true,
        pdfUrl: `/uploads/${path.basename(publicFilePath)}`,
        fallback: true,
        method: 'fallback'
      });
    }
    
  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: 'Conversion failed' },
      { status: 500 }
    );
  }
}