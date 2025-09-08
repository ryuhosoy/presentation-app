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
      console.log('Starting PowerPoint parsing with PDF conversion approach...');
      
      // First, try PDF conversion approach
      try {
        const pdfSlides = await this.convertToPDFAndExtract(file);
        if (pdfSlides && pdfSlides.length > 0) {
          console.log('Successfully extracted slides using PDF conversion');
          return pdfSlides;
        }
      } catch (pdfError) {
        console.warn('PDF conversion failed, falling back to direct parsing:', pdfError);
      }
      
      // Fallback to direct PPTX parsing
      console.log('Falling back to direct PPTX parsing...');
      this.zip = await JSZip.loadAsync(file);
      
      // Parse slide relationships
      await this.parseSlideRelations();
      
      // Extract slide content and text
      const slides = await this.extractSlides();
      
      return slides;
    } catch (error) {
      console.error('Error parsing PPTX:', error);
      throw new Error('Failed to parse PowerPoint file. Please ensure it\'s a valid .pptx file.');
    }
  }

  private async convertToPDFAndExtract(file: File): Promise<SlideData[]> {
    try {
      // Upload file to server for PDF conversion
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/convert/pptx-to-pdf', {
        method: 'POST',
        body: formData
      });
      
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
      // Dynamic import for PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdfDoc = await loadingTask.promise;
      
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
    const relsFile = this.zip?.file('ppt/_rels/presentation.xml.rels');
    if (!relsFile) return;

    const relsContent = await relsFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(relsContent, 'text/xml');
    
    const relationships = xmlDoc.querySelectorAll('Relationship');
    relationships.forEach(rel => {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      const type = rel.getAttribute('Type');
      
      if (type?.includes('slide') && id && target) {
        this.slideRelations.set(id, target);
      }
    });
  }

  private async extractSlides(): Promise<SlideData[]> {
    const slides: SlideData[] = [];
    
    // Get presentation.xml to find slide order
    const presentationFile = this.zip?.file('ppt/presentation.xml');
    if (!presentationFile) {
      throw new Error('Invalid PowerPoint file structure');
    }

    const presentationContent = await presentationFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(presentationContent, 'text/xml');
    
    const slideIds = xmlDoc.querySelectorAll('p\\:sldId, sldId');
    
    for (let i = 0; i < slideIds.length; i++) {
      const slideId = slideIds[i];
      const rId = slideId.getAttribute('r:id') || slideId.getAttribute('id');
      
      if (rId && this.slideRelations.has(rId)) {
        const slidePath = this.slideRelations.get(rId);
        if (slidePath) {
          const slideData = await this.extractSlideContent(slidePath, i + 1);
          if (slideData) {
            slides.push(slideData);
          }
        }
      }
    }

    return slides;
  }

  private async extractSlideContent(slidePath: string, slideNumber: number): Promise<SlideData | null> {
    try {
      const slideFile = this.zip?.file(`ppt/${slidePath}`);
      if (!slideFile) return null;

      const slideContent = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideContent, 'text/xml');
      
      // Extract text content from slide
      const textElements = xmlDoc.querySelectorAll('a\\:t, t');
      const slideText = Array.from(textElements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 0)
        .join(' ');

      // Try to extract actual slide image
      const slideImageUrl = await this.extractSlideImage(slidePath, slideNumber);
      
      if (slideImageUrl) {
        // Use actual slide image if available
        return {
          id: `slide-${slideNumber}`,
          imageUrl: slideImageUrl,
          startTime: (slideNumber - 1) * 10,
          duration: 10,
          text: slideText,
          slideNumber
        };
      } else {
        // Fallback to canvas rendering if no image found
        return await this.createCanvasSlide(slideText, slideNumber);
      }
      
    } catch (error) {
      console.error(`Error extracting slide ${slideNumber}:`, error);
      return null;
    }
  }

  private async extractSlideImage(slidePath: string, slideNumber: number): Promise<string | null> {
    try {
      // Method 1: Try to extract slide as image using browser APIs
      const slideImageUrl = await this.renderSlideAsImage(slidePath, slideNumber);
      if (slideImageUrl) {
        return slideImageUrl;
      }

      // Method 2: Look for slide images in the media folder
      const mediaFiles = Object.keys(this.zip?.files || {})
        .filter(fileName => fileName.startsWith('ppt/media/') && 
                           (fileName.includes(`slide${slideNumber}`) || 
                            fileName.includes(`image${slideNumber}`) ||
                            fileName.match(/\.(png|jpg|jpeg|gif)$/i)));

      if (mediaFiles.length > 0) {
        // Use the first found image
        const imageFile = this.zip?.file(mediaFiles[0]);
        if (imageFile) {
          const imageData = await imageFile.async('base64');
          const mimeType = this.getMimeType(mediaFiles[0]);
          return `data:${mimeType};base64,${imageData}`;
        }
      }

      // Method 3: Try to find slide thumbnail
      const thumbnailPath = `ppt/media/slide${slideNumber}.png`;
      const thumbnailFile = this.zip?.file(thumbnailPath);
      if (thumbnailFile) {
        const imageData = await thumbnailFile.async('base64');
        return `data:image/png;base64,${imageData}`;
      }

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
      background: '#ffffff'
    };

    // Extract text elements with their positions and styles
    const textElements = xmlDoc.querySelectorAll('a\\:p, p');
    textElements.forEach((element, index) => {
      const text = element.textContent?.trim();
      if (text) {
        // Try to extract position and style information
        const parent = element.closest('a\\:sp, sp');
        const position = this.extractElementPosition(parent);
        const style = this.extractElementStyle(parent);
        
        slideInfo.textElements.push({
          text,
          position,
          style,
          index
        });
      }
    });

    return slideInfo;
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
    
    // Set background
    ctx.fillStyle = slideInfo.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Add slide number
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Slide ${slideNumber}`, canvas.width / 2, 100);
    
    // Render text elements with their original positions and styles
    slideInfo.textElements.forEach((textElement: any) => {
      const { text, position, style } = textElement;
      
      ctx.fillStyle = style.color;
      ctx.font = `${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = 'left';
      
      // Scale position to canvas size (PowerPoint uses different units)
      const x = (position.x / 914400) * canvas.width; // PowerPoint uses EMUs
      const y = (position.y / 914400) * canvas.height;
      const maxWidth = (position.width / 914400) * canvas.width;
      
      // Wrap text if needed
      const words = text.split(' ');
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
      
      // Draw lines
      lines.forEach((line, index) => {
        ctx.fillText(line, x, y + (index * style.fontSize * 1.2));
      });
    });
    
    return canvas.toDataURL('image/png');
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
    // Create a canvas to render slide preview
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Create a simple slide preview with text
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      // Add slide number
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 48px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Slide ${slideNumber}`, canvas.width / 2, 100);
      
      // Add text content (wrapped)
      if (slideText) {
        ctx.fillStyle = '#1e293b';
        ctx.font = '32px Inter, sans-serif';
        ctx.textAlign = 'left';
        
        const words = slideText.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        const maxWidth = canvas.width - 200;
        
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
        
        // Draw lines
        lines.slice(0, 20).forEach((line, index) => {
          ctx.fillText(line, 100, 200 + (index * 50));
        });
      }
      
      // Convert canvas to blob URL
      const imageUrl = canvas.toDataURL('image/png');
      
      return {
        id: `slide-${slideNumber}`,
        imageUrl,
        startTime: (slideNumber - 1) * 10,
        duration: 10,
        text: slideText,
        slideNumber
      };
    }
    
    throw new Error('Failed to create canvas slide');
  }
}

export async function parsePowerPointFile(file: File): Promise<SlideData[]> {
  const parser = new PPTXParser();
  return await parser.parsePPTX(file);
}