// PDF変換方式の実装
import JSZip from 'jszip';

export interface SlideData {
  id: string;
  imageUrl: string;
  startTime: number;
  duration: number;
  text?: string;
  slideNumber: number;
}

export class PDFConverter {
  private zip: JSZip | null = null;

  async convertPPTXToPDF(file: File): Promise<SlideData[]> {
    try {
      // 1. パワーポイントファイルをサーバーにアップロード
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/convert/pptx-to-pdf', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('PDF conversion failed');
      }
      
      const result = await response.json();
      
      // 2. 変換されたPDFからスライドを抽出
      return await this.extractSlidesFromPDF(result.pdfUrl);
      
    } catch (error) {
      console.error('PDF conversion error:', error);
      throw new Error('Failed to convert PowerPoint to PDF');
    }
  }

  private async extractSlidesFromPDF(pdfUrl: string): Promise<SlideData[]> {
    try {
      // PDF.jsを使用してPDFを読み込み
      const pdf = await import('pdfjs-dist');
      const loadingTask = pdf.getDocument(pdfUrl);
      const pdfDoc = await loadingTask.promise;
      
      const slides: SlideData[] = [];
      
      // 各ページ（スライド）を処理
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        
        // Canvasを作成してページをレンダリング
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // テキストコンテンツを抽出
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        // 画像URLを生成
        const imageUrl = canvas.toDataURL('image/png');
        
        slides.push({
          id: `slide-${pageNum}`,
          imageUrl,
          startTime: (pageNum - 1) * 10,
          duration: 10,
          text: text.trim(),
          slideNumber: pageNum
        });
      }
      
      return slides;
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract slides from PDF');
    }
  }
}

export async function convertPowerPointToPDF(file: File): Promise<SlideData[]> {
  const converter = new PDFConverter();
  return await converter.convertPPTXToPDF(file);
}
