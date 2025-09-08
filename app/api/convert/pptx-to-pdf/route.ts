import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

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

    // 一時ディレクトリを作成
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // ファイルを一時保存
    const tempFilePath = path.join(tempDir, `temp-${Date.now()}.pptx`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer as any);
    
    // PDF出力パス
    const pdfPath = path.join(tempDir, `output-${Date.now()}.pdf`);
    
    try {
      // Check if LibreOffice is available
      try {
        await execAsync('libreoffice --version');
        console.log('LibreOffice is available, proceeding with PDF conversion');
      } catch (versionError) {
        console.log('LibreOffice not available, using fallback method');
        throw new Error('LibreOffice not installed');
      }

      // LibreOfficeを使用してPDF変換
      const command = `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${tempFilePath}"`;
      console.log('Executing LibreOffice command:', command);
      
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      console.log('LibreOffice stdout:', stdout);
      if (stderr) console.log('LibreOffice stderr:', stderr);
      
      // 変換されたPDFファイルを確認
      const convertedPdfPath = tempFilePath.replace('.pptx', '.pdf');
      console.log('Looking for converted PDF at:', convertedPdfPath);
      
      if (await fs.access(convertedPdfPath).then(() => true).catch(() => false)) {
        console.log('PDF conversion successful');
        
        // PDFファイルを読み込み
        const pdfBuffer = await fs.readFile(convertedPdfPath);
        
        // 公開ディレクトリに保存
        const publicDir = path.join(process.cwd(), 'public', 'converted');
        await fs.mkdir(publicDir, { recursive: true });
        
        const publicPdfPath = path.join(publicDir, `converted-${Date.now()}.pdf`);
        await fs.writeFile(publicPdfPath, pdfBuffer as any);
        
        // 一時ファイルを削除
        await fs.unlink(tempFilePath);
        await fs.unlink(convertedPdfPath);
        
        console.log('PDF conversion completed successfully');
        return NextResponse.json({
          success: true,
          pdfUrl: `/converted/${path.basename(publicPdfPath)}`,
          method: 'libreoffice'
        });
      } else {
        throw new Error('PDF conversion failed - output file not found');
      }
      
    } catch (conversionError) {
      console.error('LibreOffice conversion error:', conversionError);
      
      // LibreOfficeが利用できない場合のフォールバック
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
