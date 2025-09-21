import JSZip from 'jszip';

export interface SlideData {
  id: string;
  imageUrl: string;
  startTime: number;
  duration: number;
  text?: string;
  slideNumber: number;
}

export class PPTXParser {
  private zip: JSZip | null = null;
  private slideRelations: Map<string, string> = new Map();
  private slideTexts: Map<string, string> = new Map();

  async parsePPTX(file: File): Promise<SlideData[]> {
    try {
      console.log(`[parsePPTX] 開始: ファイル名=${file.name}, サイズ=${file.size}bytes`);
      console.log('Starting PowerPoint parsing with direct image conversion and PPTX analysis...');
      
      // First, try direct image conversion for high-quality images
      try {
        console.log("[parsePPTX] 直接画像変換アプローチを試行します...");
        const imageSlides = await this.convertToImagesAndExtract(file);
        if (imageSlides && imageSlides.length > 0) {
          console.log(`[parsePPTX] 直接画像変換で${imageSlides.length}枚のスライドを抽出しました`);
          
          // 直接PPTX解析でテキストを抽出して結合
          console.log("[parsePPTX] テキスト抽出のために直接PPTX解析を実行します...");
          const textSlides = await this.extractTextFromPPTX(file);
          
          // 画像とテキストを結合
          const combinedSlides = this.combineImageAndTextSlides(imageSlides, textSlides);
          console.log(`[parsePPTX] 画像とテキストを結合しました: ${combinedSlides.length}枚のスライド`);
          
          return combinedSlides;
        }
      } catch (imageError) {
        console.warn('[parsePPTX] 直接画像変換に失敗しました。直接PPTX解析のみを実行します:', imageError);
      }
      
      // Fallback to direct PPTX parsing only
      console.log('[parsePPTX] 直接PPTX解析のみを実行します...');
      const slides = await this.extractTextFromPPTX(file);
      
      console.log(`[parsePPTX] 完了: ${slides.length}枚のスライドを抽出しました`);
      return slides;
    } catch (error) {
      console.error('[parsePPTX] PPTX解析エラー:', error);
      throw new Error('Failed to parse PowerPoint file. Please ensure it\'s a valid .pptx file.');
    }
  }

  private async extractTextFromPPTX(file: File): Promise<SlideData[]> {
    console.log('[extractTextFromPPTX] 直接PPTX解析でテキスト抽出を開始します...');
    this.zip = await JSZip.loadAsync(file);
    console.log(`[extractTextFromPPTX] ZIPファイルを読み込みました。ファイル数: ${Object.keys(this.zip.files).length}`);
    
    // Parse slide relationships
    console.log('[extractTextFromPPTX] スライド関係を解析します...');
    await this.parseSlideRelations();
    console.log(`[extractTextFromPPTX] スライド関係を解析しました。関係数: ${this.slideRelations.size}`);
    
    // Extract slide content and text
    console.log('[extractTextFromPPTX] スライドコンテンツとテキストを抽出します...');
    const slides = await this.extractSlides();
    
    console.log(`[extractTextFromPPTX] 完了: ${slides.length}枚のスライドからテキストを抽出しました`);
    return slides;
  }

  private combineImageAndTextSlides(imageSlides: SlideData[], textSlides: SlideData[]): SlideData[] {
    console.log(`[combineImageAndTextSlides] 画像スライド: ${imageSlides.length}枚, テキストスライド: ${textSlides.length}枚`);
    
    return imageSlides.map((imageSlide, index) => {
      const textSlide = textSlides[index];
      const combinedSlide = {
        ...imageSlide,
        text: textSlide ? textSlide.text : imageSlide.text,
        slideNumber: imageSlide.slideNumber || index + 1
      };
      
      console.log(`[combineImageAndTextSlides] スライド${index + 1}を結合: テキスト="${combinedSlide.text}"`);
      return combinedSlide;
    });
  }

  private async convertToImagesAndExtract(file: File): Promise<SlideData[]> {
    try {
      // Upload file to server for direct image conversion
      const formData = new FormData();
      formData.append('file', file);
      
      console.log("before fetch('/api/convert/pptx-to-images') in pptx-parser.ts convertToImagesAndExtract");
      const response = await fetch('/api/convert/pptx-to-images', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Direct image conversion failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.fallback) {
        console.log('Server-side direct image conversion not available, using fallback');
        return [];
      }
      
      // Convert images to slide data
      const slides: SlideData[] = [];
      
      if (result.isCombinedImage && result.images.length === 1) {
        // 1つの画像に複数スライドが結合されている場合
        console.log('Detected combined image - will use client-side parsing for individual slides');
        return []; // クライアントサイドのCanvasレンダリングにフォールバック
      }
      
      result.images.forEach((imageData: string, index: number) => {
        slides.push({
          id: `slide-${index + 1}`,
          imageUrl: imageData,
          startTime: index * 10,
          duration: 10,
          text: `Slide ${index + 1} content`,
          slideNumber: index + 1
        });
      });
      
      console.log(`Successfully converted ${slides.length} slides to images`);
      return slides;
      
    } catch (error) {
      console.error('Direct image conversion error:', error);
      throw error;
    }
  }

  private async convertToPDFAndExtract(file: File): Promise<SlideData[]> {
    try {
      // Upload file to server for PDF conversion
      const formData = new FormData();
      formData.append('file', file);
      
      console.log("before fetch('/api/convert/pptx-to-pdf') in pptx-parser.ts convertToPDFAndExtract");
      const response = await fetch('/api/convert/pptx-to-pdf', {
        method: 'POST',
        body: formData
      });

      console.log("after fetch('/api/convert/pptx-to-pdf') in pptx-parser.ts convertToPDFAndExtract", response);

      if (!response.ok) {
        throw new Error(`PDF conversion failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.fallback) {
        console.log('Server-side PDF conversion not available, using fallback');
        return [];
      }
      
      // Extract slides from converted PDF
      return await this.extractSlidesFromPDF(result.pdfUrl);
      
    } catch (error) {
      console.error('PDF conversion error:', error);
      throw error;
    }
  }

  private async extractSlidesFromPDF(pdfUrl: string): Promise<SlideData[]> {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        console.warn('PDF extraction is only available in browser environment');
        return [];
      }

      // Dynamic import for PDF.js with proper error handling
      let pdfjsLib;
      try {
        pdfjsLib = await import('pdfjs-dist');
      } catch (importError) {
        console.error('Failed to import pdfjs-dist:', importError);
        throw new Error('PDF.js library could not be loaded');
      }
      
      // Set worker source with fallback
      try {
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        }
      } catch (workerError) {
        console.warn('Failed to set PDF.js worker source:', workerError);
      }
      
      // Load PDF document with timeout
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      
      const pdfDoc = await Promise.race([
        loadingTask.promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF loading timeout')), 30000)
        )
      ]) as any;
      
      console.log(`PDF loaded successfully with ${pdfDoc.numPages} pages`);
      
      const slides: SlideData[] = [];
      
      // Process each page (slide)
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        
        // Create canvas for rendering
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Failed to get canvas context');
        }
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        }).promise;
        
        // Extract text content
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();
        
        // Convert canvas to data URL
        const imageUrl = canvas.toDataURL('image/png');
        
        slides.push({
          id: `slide-${pageNum}`,
          imageUrl,
          startTime: (pageNum - 1) * 10,
          duration: 10,
          text: text,
          slideNumber: pageNum
        });
        
        console.log(`Processed slide ${pageNum}: ${text.substring(0, 100)}...`);
      }
      
      return slides;
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw error;
    }
  }

  private async parseSlideRelations(): Promise<void> {
    console.log(`[parseSlideRelations] 開始: スライド関係を解析します`);
    const relsFile = this.zip?.file('ppt/_rels/presentation.xml.rels');
    if (!relsFile) {
      console.warn(`[parseSlideRelations] presentation.xml.relsが見つかりません`);
      return;
    }
    console.log(`[parseSlideRelations] presentation.xml.relsを取得しました`);

    const relsContent = await relsFile.async('text');
    console.log(`[parseSlideRelations] 関係ファイルの内容を読み込みました。長さ: ${relsContent.length}文字`);
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(relsContent, 'text/xml');
    console.log(`[parseSlideRelations] 関係ファイルを解析しました`);
    
    const relationships = xmlDoc.querySelectorAll('Relationship');
    console.log(`[parseSlideRelations] 関係要素を検索しました。見つかった関係数: ${relationships.length}`);
    
    let slideRelationCount = 0;
    relationships.forEach((rel, index) => {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      const type = rel.getAttribute('Type');
      
      console.log(`[parseSlideRelations] 関係${index + 1}: id=${id}, target=${target}, type=${type}`);
      
      if (type?.includes('slide') && id && target) {
        this.slideRelations.set(id, target);
        slideRelationCount++;
        console.log(`[parseSlideRelations] スライド関係を追加: ${id} -> ${target}`);
      }
    });
    
    console.log(`[parseSlideRelations] 完了: ${slideRelationCount}個のスライド関係を解析しました`);
  }

  private async extractSlides(): Promise<SlideData[]> {
    console.log(`[extractSlides] 開始: スライドの抽出を開始します`);
    const slides: SlideData[] = [];
    
    // Get presentation.xml to find slide order
    const presentationFile = this.zip?.file('ppt/presentation.xml');
    if (!presentationFile) {
      console.error(`[extractSlides] presentation.xmlが見つかりません`);
      throw new Error('Invalid PowerPoint file structure');
    }
    console.log(`[extractSlides] presentation.xmlを取得しました`);

    const presentationContent = await presentationFile.async('text');
    console.log(`[extractSlides] presentation.xmlの内容を読み込みました。長さ: ${presentationContent.length}文字`);
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(presentationContent, 'text/xml');
    console.log(`[extractSlides] presentation.xmlを解析しました`);
    
    const slideIds = xmlDoc.querySelectorAll('p\\:sldId, sldId');
    console.log(`[extractSlides] スライドIDを検索しました。見つかったスライド数: ${slideIds.length}`);
    
    for (let i = 0; i < slideIds.length; i++) {
      const slideId = slideIds[i];
      const rId = slideId.getAttribute('r:id') || slideId.getAttribute('id');
      console.log(`[extractSlides] スライド${i + 1}: rId=${rId}`);
      
      if (rId && this.slideRelations.has(rId)) {
        const slidePath = this.slideRelations.get(rId);
        console.log(`[extractSlides] スライド${i + 1}: slidePath=${slidePath}`);
        if (slidePath) {
          const slideData = await this.extractSlideContent(slidePath, i + 1);
          if (slideData) {
            console.log(`[extractSlides] スライド${i + 1}のデータを取得しました:`, slideData);
            slides.push(slideData);
          } else {
            console.warn(`[extractSlides] スライド${i + 1}のデータの取得に失敗しました`);
          }
        }
      } else {
        console.warn(`[extractSlides] スライド${i + 1}: rIdが見つからないか、slideRelationsに存在しません`);
      }
    }

    console.log(`[extractSlides] 完了: ${slides.length}枚のスライドを抽出しました`);
    return slides;
  }

  private async extractSlideContent(slidePath: string, slideNumber: number): Promise<SlideData | null> {
    try {
      console.log(`[extractSlideContent] 開始: slidePath=${slidePath}, slideNumber=${slideNumber}`);
      
      const slideFile = this.zip?.file(`ppt/${slidePath}`);
      if (!slideFile) {
        console.log(`[extractSlideContent] スライドファイルが見つかりません: ${slidePath}`);
        return null;
      }
      console.log(`[extractSlideContent] スライドファイルを取得しました: ${slidePath}`);

      const slideContent = await slideFile.async('text');
      console.log(`[extractSlideContent] スライドコンテンツを読み込みました。長さ: ${slideContent.length}文字`);
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideContent, 'text/xml');
      console.log(`[extractSlideContent] XMLドキュメントを解析しました`);
      
      // Extract text content from slide
      const textElements = xmlDoc.querySelectorAll('a\\:t, t');
      console.log(`[extractSlideContent] テキスト要素を検索しました。見つかった要素数: ${textElements.length}`);
      
      if (textElements.length > 0) {
        console.log(`[extractSlideContent] 各テキスト要素の内容:`);
        Array.from(textElements).forEach((el, index) => {
          console.log(`  [${index}] "${el.textContent?.trim()}"`);
        });
      }
      
      const slideText = Array.from(textElements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 0)
        .join(' ');

      console.log(`[extractSlideContent] 最終的なslideText: "${slideText}"`);

      // Try to extract actual slide image
      console.log(`[extractSlideContent] スライド画像の抽出を開始します`);
      const slideImageUrl = await this.extractSlideImage(slidePath, slideNumber);
      
      if (slideImageUrl) {
        // Use actual slide image if available
        console.log(`[extractSlideContent] スライド画像を取得しました。SlideDataオブジェクトを作成します`);
        const slideData = {
          id: `slide-${slideNumber}`,
          imageUrl: slideImageUrl,
          startTime: (slideNumber - 1) * 10,
          duration: 10,
          text: slideText,
          slideNumber
        };
        console.log(`[extractSlideContent] SlideData作成完了:`, slideData);
        return slideData;
      } else {
        // Fallback to canvas rendering if no image found
        console.log(`[extractSlideContent] スライド画像が見つかりません。Canvasレンダリングにフォールバックします`);
        return await this.createCanvasSlide(slideText, slideNumber);
      }
      
    } catch (error) {
      console.error(`[extractSlideContent] スライド${slideNumber}の抽出エラー:`, error);
      console.error(`[extractSlideContent] slidePath: ${slidePath}`);
      return null;
    }
  }

  private async extractSlideImage(slidePath: string, slideNumber: number): Promise<string | null> {
    try {
      // Method 1: Look for slide images in the media folder with better pattern matching
      const mediaFiles = Object.keys(this.zip?.files || {})
        .filter(fileName => {
          const isMediaFile = fileName.startsWith('ppt/media/') || fileName.startsWith('ppt/slides/media/');
          const isImageFile = fileName.match(/\.(png|jpg|jpeg|gif|bmp|tiff)$/i);
          const matchesSlide = fileName.includes(`slide${slideNumber}`) || 
                              fileName.includes(`image${slideNumber}`) ||
                              fileName.includes(`media${slideNumber}`) ||
                              fileName.match(new RegExp(`slide[_-]?${slideNumber}`, 'i'));
          return isMediaFile && isImageFile && matchesSlide;
        });

      if (mediaFiles.length > 0) {
        // Sort by filename length (prefer more specific names)
        mediaFiles.sort((a, b) => a.length - b.length);
        const imageFile = this.zip?.file(mediaFiles[0]);
        if (imageFile) {
          const imageData = await imageFile.async('base64');
          const mimeType = this.getMimeType(mediaFiles[0]);
          console.log(`Found slide image: ${mediaFiles[0]}`);
          return `data:${mimeType};base64,${imageData}`;
        }
      }

      // Method 2: Look for any image files in the slide's media folder
      const slideMediaPath = `ppt/slides/media/`;
      const slideMediaFiles = Object.keys(this.zip?.files || {})
        .filter(fileName => fileName.startsWith(slideMediaPath) && 
                           fileName.match(/\.(png|jpg|jpeg|gif|bmp|tiff)$/i));

      if (slideMediaFiles.length > 0) {
        // Use the first available image
        const imageFile = this.zip?.file(slideMediaFiles[0]);
        if (imageFile) {
          const imageData = await imageFile.async('base64');
          const mimeType = this.getMimeType(slideMediaFiles[0]);
          console.log(`Using slide media image: ${slideMediaFiles[0]}`);
          return `data:${mimeType};base64,${imageData}`;
        }
      }

      // Method 3: Try to extract slide as image using browser APIs
      const slideImageUrl = await this.renderSlideAsImage(slidePath, slideNumber);
      if (slideImageUrl) {
        return slideImageUrl;
      }

      // Method 4: Look for slide thumbnails in different locations
      const thumbnailPaths = [
        `ppt/media/slide${slideNumber}.png`,
        `ppt/media/slide${slideNumber}.jpg`,
        `ppt/slides/media/slide${slideNumber}.png`,
        `ppt/slides/media/slide${slideNumber}.jpg`
      ];

      for (const thumbnailPath of thumbnailPaths) {
        const thumbnailFile = this.zip?.file(thumbnailPath);
        if (thumbnailFile) {
          const imageData = await thumbnailFile.async('base64');
          const mimeType = this.getMimeType(thumbnailPath);
          console.log(`Found thumbnail: ${thumbnailPath}`);
          return `data:${mimeType};base64,${imageData}`;
        }
      }

      console.log(`No image found for slide ${slideNumber}, will use canvas rendering`);
      return null;
    } catch (error) {
      console.error(`Error extracting slide image for slide ${slideNumber}:`, error);
      return null;
    }
  }

  private async renderSlideAsImage(slidePath: string, slideNumber: number): Promise<string | null> {
    try {
      // This is a simplified approach - in reality, rendering PowerPoint slides
      // with exact fidelity requires complex libraries like LibreOffice or server-side conversion
      
      // For now, we'll create a more detailed canvas representation
      const slideFile = this.zip?.file(`ppt/${slidePath}`);
      if (!slideFile) return null;

      const slideContent = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideContent, 'text/xml');
      
      // Extract more detailed slide information
      const slideInfo = this.extractSlideInfo(xmlDoc);
      
      // Create a more accurate canvas representation
      return this.createDetailedCanvasSlide(slideInfo, slideNumber);
      
    } catch (error) {
      console.error(`Error rendering slide ${slideNumber}:`, error);
      return null;
    }
  }

  private extractSlideInfo(xmlDoc: Document): any {
    const slideInfo: any = {
      textElements: [],
      shapes: [],
      background: '#ffffff',
      title: '',
      content: []
    };

    // Extract slide background
    const background = xmlDoc.querySelector('p\\:bg, bg');
    if (background) {
      const solidFill = background.querySelector('a\\:solidFill, solidFill');
      if (solidFill) {
        const srgbClr = solidFill.querySelector('a\\:srgbClr, srgbClr');
        if (srgbClr) {
          const val = srgbClr.getAttribute('val');
          if (val) {
            slideInfo.background = `#${val}`;
          }
        }
      }
    }

    // Extract text elements with their positions and styles
    const textElements = xmlDoc.querySelectorAll('a\\:p, p');
    textElements.forEach((element, index) => {
      const text = element.textContent?.trim();
      if (text && text.length > 0) {
        // Try to extract position and style information
        const parent = element.closest('a\\:sp, sp');
        const position = this.extractElementPosition(parent);
        const style = this.extractElementStyle(parent);
        
        // Determine if this is a title or content
        const isTitle = this.isTitleElement(element, parent);
        
        slideInfo.textElements.push({
          text,
          position,
          style,
          index,
          isTitle
        });

        if (isTitle) {
          slideInfo.title = text;
        } else {
          slideInfo.content.push(text);
        }
      }
    });

    // If no title found, use the first text element as title
    if (!slideInfo.title && slideInfo.textElements.length > 0) {
      slideInfo.title = slideInfo.textElements[0].text;
    }

    return slideInfo;
  }

  private isTitleElement(element: Element, parent: Element | null): boolean {
    // Check if this element is likely a title based on various criteria
    if (!parent) return false;
    
    // Check for title-specific attributes or classes
    const ph = parent.querySelector('p\\:ph, ph');
    if (ph) {
      const type = ph.getAttribute('type');
      if (type === 'title' || type === 'ctrTitle' || type === 'subTitle') {
        return true;
      }
    }
    
    // Check font size (titles are usually larger)
    const runProps = element.querySelector('a\\:rPr, rPr');
    if (runProps) {
      const fontSize = runProps.getAttribute('sz');
      if (fontSize && parseInt(fontSize) > 2000) { // Larger than 20pt
        return true;
      }
    }
    
    // Check if it's the first text element (often the title)
    const allTextElements = parent.ownerDocument?.querySelectorAll('a\\:p, p');
    if (allTextElements && element === allTextElements[0]) {
      return true;
    }
    
    return false;
  }

  private extractElementPosition(element: Element | null): any {
    if (!element) return { x: 100, y: 100, width: 800, height: 100 };
    
    // Extract position from PowerPoint XML structure
    const transform = element.querySelector('a\\:xfrm, xfrm');
    if (transform) {
      const off = transform.querySelector('a\\:off, off');
      const ext = transform.querySelector('a\\:ext, ext');
      
      if (off && ext) {
        return {
          x: parseInt(off.getAttribute('x') || '100'),
          y: parseInt(off.getAttribute('y') || '100'),
          width: parseInt(ext.getAttribute('cx') || '800'),
          height: parseInt(ext.getAttribute('cy') || '100')
        };
      }
    }
    
    return { x: 100, y: 100, width: 800, height: 100 };
  }

  private extractElementStyle(element: Element | null): any {
    if (!element) return { fontSize: 32, color: '#1e293b', fontFamily: 'Arial' };
    
    // Extract style information from PowerPoint XML
    const textProps = element.querySelector('a\\:pPr, pPr');
    const runProps = element.querySelector('a\\:rPr, rPr');
    
    const style: any = {
      fontSize: 32,
      color: '#1e293b',
      fontFamily: 'Arial'
    };
    
    if (runProps) {
      const fontSize = runProps.getAttribute('sz');
      if (fontSize) {
        style.fontSize = parseInt(fontSize) / 100; // PowerPoint uses 100ths of a point
      }
      
      const color = runProps.querySelector('a\\:solidFill, solidFill');
      if (color) {
        const rgbColor = color.querySelector('a\\:srgbClr, srgbClr');
        if (rgbColor) {
          const val = rgbColor.getAttribute('val');
          if (val) {
            style.color = `#${val}`;
          }
        }
      }
    }
    
    return style;
  }

  private createDetailedCanvasSlide(slideInfo: any, slideNumber: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Set background with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, slideInfo.background);
    gradient.addColorStop(1, this.lightenColor(slideInfo.background, 0.1));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Add slide number
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Slide ${slideNumber}`, canvas.width / 2, 60);
    
    // Add divider line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 90);
    ctx.lineTo(canvas.width - 100, 90);
    ctx.stroke();
    
    // Render title if available
    if (slideInfo.title) {
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 48px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(slideInfo.title, canvas.width / 2, 160);
    }
    
    // Render text elements with their original positions and styles
    slideInfo.textElements.forEach((textElement: any) => {
      const { text, position, style, isTitle } = textElement;
      
      // Skip title if already rendered
      if (isTitle && slideInfo.title) return;
      
      ctx.fillStyle = style.color;
      ctx.font = `${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = 'left';
      
      // PowerPoint uses EMUs (English Metric Units) where 1 inch = 914400 EMUs
      // Standard PowerPoint slide size is 10" x 7.5" (9600000 x 7200000 EMUs)
      const slideWidthEMU = 9600000;
      const slideHeightEMU = 7200000;
      
      // Convert EMU coordinates to canvas coordinates with proper scaling
      const x = (position.x / slideWidthEMU) * canvas.width;
      const y = (position.y / slideHeightEMU) * canvas.height;
      const maxWidth = (position.width / slideWidthEMU) * canvas.width;
      
      // Ensure coordinates are within canvas bounds
      const clampedX = Math.max(100, Math.min(x, canvas.width - 100));
      const clampedY = Math.max(200, Math.min(y, canvas.height - 100));
      const clampedMaxWidth = Math.min(maxWidth, canvas.width - clampedX - 100);
      
      // Wrap text if needed
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      words.forEach((word: string) => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > clampedMaxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Draw lines with proper line spacing
      const lineHeight = style.fontSize * 1.4;
      lines.forEach((line, index) => {
        const lineY = clampedY + (index * lineHeight);
        if (lineY < canvas.height - 100) { // Ensure text doesn't go off canvas
          ctx.fillText(line, clampedX, lineY);
        }
      });
    });
    
    // Add footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Slide ${slideNumber}`, canvas.width - 100, canvas.height - 50);
    
    return canvas.toDataURL('image/png', 0.95);
  }

  private lightenColor(color: string, factor: number): string {
    // Simple color lightening function
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.floor(255 * factor));
      const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.floor(255 * factor));
      const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.floor(255 * factor));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return color;
  }

  private getMimeType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'gif': return 'image/gif';
      case 'bmp': return 'image/bmp';
      default: return 'image/png';
    }
  }

  private async createCanvasSlide(slideText: string, slideNumber: number): Promise<SlideData> {
    console.log(`[createCanvasSlide] 開始: slideNumber=${slideNumber}, slideText="${slideText}"`);
    
    // Create a high-quality canvas to render slide preview
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    console.log(`[createCanvasSlide] Canvasを作成しました: ${canvas.width}x${canvas.height}`);
    
    if (ctx) {
      // Enable high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Create a professional slide background with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, '#f8fafc');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add subtle border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      // Add slide number with better styling
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Slide ${slideNumber}`, canvas.width / 2, 80);
      
      // Add a subtle divider line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(100, 120);
      ctx.lineTo(canvas.width - 100, 120);
      ctx.stroke();
      
      // Add text content with better formatting
      if (slideText && slideText.trim()) {
        ctx.fillStyle = '#1e293b';
        ctx.font = '28px Inter, sans-serif';
        ctx.textAlign = 'left';
        
        // Split text into paragraphs
        const paragraphs = slideText.split('\n').filter(p => p.trim());
        let currentY = 180;
        const lineHeight = 36;
        const maxWidth = canvas.width - 200;
        const maxLines = Math.floor((canvas.height - currentY - 100) / lineHeight);
        let totalLines = 0;
        
        for (const paragraph of paragraphs) {
          if (totalLines >= maxLines) break;
          
          const words = paragraph.trim().split(' ');
          const lines: string[] = [];
          let currentLine = '';
          
          words.forEach((word: string) => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          
          if (currentLine) {
            lines.push(currentLine);
          }
          
          // Draw lines with proper spacing
          lines.forEach((line, index) => {
            if (totalLines < maxLines) {
              ctx.fillText(line, 100, currentY + (totalLines * lineHeight));
              totalLines++;
            }
          });
          
          // Add space between paragraphs
          if (totalLines < maxLines) {
            totalLines++;
          }
        }
        
        // Add ellipsis if text was truncated
        if (totalLines >= maxLines) {
          ctx.fillStyle = '#64748b';
          ctx.font = '24px Inter, sans-serif';
          ctx.fillText('...', 100, currentY + (totalLines * lineHeight));
        }
      } else {
        // Show placeholder text if no content
        ctx.fillStyle = '#94a3b8';
        ctx.font = '24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No content available', canvas.width / 2, canvas.height / 2);
      }
      
      // Add footer with slide info
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Slide ${slideNumber}`, canvas.width - 100, canvas.height - 50);
      
      // Convert canvas to high-quality data URL
      console.log(`[createCanvasSlide] Canvasを画像URLに変換します`);
      const imageUrl = canvas.toDataURL('image/png', 0.95);
      console.log(`[createCanvasSlide] 画像URLを生成しました。長さ: ${imageUrl.length}文字`);
      
      const slideData = {
        id: `slide-${slideNumber}`,
        imageUrl,
        startTime: (slideNumber - 1) * 10,
        duration: 10,
        text: slideText,
        slideNumber
      };
      console.log(`[createCanvasSlide] SlideData作成完了:`, slideData);
      return slideData;
    }
    
    console.error(`[createCanvasSlide] Canvasコンテキストの取得に失敗しました`);
    throw new Error('Failed to create canvas slide');
  }
}

export async function parsePowerPointFile(file: File): Promise<SlideData[]> {
  const parser = new PPTXParser();
  console.log("file in pptx-parser.ts", file);
  return await parser.parsePPTX(file);
}