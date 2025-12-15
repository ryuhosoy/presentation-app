import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'ファイルがアップロードされていません' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.pptx')) {
      return NextResponse.json(
        { error: 'PowerPointファイル(.pptx)のみサポートしています' },
        { status: 400 }
      );
    }

    // 一時ディレクトリを作成（サーバーレス環境対応）
    const tempDir = path.join(
      process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'temp'),
      `pptx-${Date.now()}`
    );
    await fs.mkdir(tempDir, { recursive: true });

    // ファイルを保存
    const filePath = path.join(tempDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    try {
      // LibreOfficeを使用してPowerPointを画像に変換
      const outputDir = path.join(tempDir, 'images');
      await fs.mkdir(outputDir, { recursive: true });

      // LibreOfficeでPowerPointを直接画像に変換
      console.log(`Converting ${filePath} directly to images...`);
      
      let conversionSuccess = false;
      
      // Method 1: LibreOfficeでPowerPointをPDFに変換してから各ページを画像に変換
      try {
        console.log('Trying LibreOffice PDF + ImageMagick conversion (recommended for multiple slides)...');
        const pdfPath = path.join(tempDir, 'output.pdf');
        
        // PowerPointをPDFに変換
        await execAsync(`libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${filePath}"`);
        
        // PDFファイルのパスを確認（LibreOfficeは元のファイル名でPDFを作成）
        const expectedPdfPath = path.join(tempDir, path.basename(filePath, '.pptx') + '.pdf');
        if (await fs.access(expectedPdfPath).then(() => true).catch(() => false)) {
          await fs.rename(expectedPdfPath, pdfPath);
        }
        
        // PDFを画像に変換（各ページを個別の画像として生成）
        await execAsync(`convert -density 300 "${pdfPath}" -quality 100 "${outputDir}/slide_%d.png"`);
        conversionSuccess = true;
        console.log('LibreOffice PDF + ImageMagick conversion successful');
      } catch (directError) {
        console.log('Direct PNG conversion failed:', directError);
        
        // Method 2: LibreOfficeでPDFに変換してからPopplerで画像に変換（フォールバック）
        try {
          console.log('Trying LibreOffice PDF + Poppler conversion...');
          const pdfPath = path.join(tempDir, 'output.pdf');
          
          // PowerPointをPDFに変換
          await execAsync(`libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${filePath}"`);
          
          // PDFファイルのパスを確認
          const expectedPdfPath = path.join(tempDir, path.basename(filePath, '.pptx') + '.pdf');
          if (await fs.access(expectedPdfPath).then(() => true).catch(() => false)) {
            await fs.rename(expectedPdfPath, pdfPath);
          }
          
          // PDFを画像に変換（各ページを個別の画像として生成）
          await execAsync(`pdftoppm -png -r 300 "${pdfPath}" "${outputDir}/slide"`);
          conversionSuccess = true;
          console.log('LibreOffice PDF + Poppler conversion successful');
        } catch (popplerError) {
          console.log('Poppler conversion failed:', popplerError);
          
          // Method 3: LibreOfficeで直接PNG変換（最後の手段）
          try {
            console.log('Trying LibreOffice direct PNG conversion (may combine slides)...');
            await execAsync(`libreoffice --headless --convert-to png --outdir "${outputDir}" "${filePath}"`);
            conversionSuccess = true;
            console.log('LibreOffice direct PNG conversion successful');
          } catch (directPngError) {
            console.log('Direct PNG conversion failed:', directPngError);
          }
        }
      }
      
      if (!conversionSuccess) {
        throw new Error('All PowerPoint to image conversion methods failed. Please check LibreOffice installation.');
      }

      // 生成された画像ファイルを読み込み
      const imageFiles = await fs.readdir(outputDir);
      console.log('Generated image files:', imageFiles);
      
      const imageFiles_png = imageFiles.filter(file => file.endsWith('.png')).sort();
      console.log('PNG files found:', imageFiles_png);
      
      if (imageFiles_png.length === 0) {
        throw new Error('No PNG images were generated. Check the conversion process.');
      }
      
      const images: string[] = [];
      for (const imageFile of imageFiles_png) {
        const imagePath = path.join(outputDir, imageFile);
        const imageBuffer = await fs.readFile(imagePath);
        const base64 = imageBuffer.toString('base64');
        images.push(`data:image/png;base64,${base64}`);
        console.log(`Processed image: ${imageFile} (${imageBuffer.length} bytes)`);
      }
      
      console.log(`Total images processed: ${images.length}`);

      // LibreOfficeの直接PNG変換で1つの画像に複数スライドが結合されている場合の処理
      if (images.length === 1 && imageFiles_png.length === 1) {
        console.log('Only one image found - checking if it contains multiple slides...');
        // この場合、クライアントサイドでCanvasレンダリングにフォールバック
        console.log('Falling back to client-side canvas rendering for multiple slides');
      }

      // 一時ファイルを削除
      await fs.rm(tempDir, { recursive: true, force: true });

      return NextResponse.json({
        success: true,
        images,
        slideCount: images.length,
        isCombinedImage: images.length === 1 && imageFiles_png.length === 1
      });

    } catch (conversionError) {
      // 一時ファイルを削除
      await fs.rm(tempDir, { recursive: true, force: true });
      
      console.error('Conversion error:', conversionError);
      return NextResponse.json(
        { 
          error: 'PowerPointファイルの変換に失敗しました',
          details: conversionError instanceof Error ? conversionError.message : 'Unknown error',
          fallback: true
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('File processing error:', error);
    return NextResponse.json(
      { 
        error: 'ファイルの処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
