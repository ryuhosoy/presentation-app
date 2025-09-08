const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { PPTXProcessor } = require('./processors/pptx-processor');
const { AudioProcessor } = require('./processors/audio-processor');
const { VideoGenerator } = require('./processors/video-generator');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/output', express.static(path.join(__dirname, 'output')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'audio/mpeg',
      'audio/wav',
      'audio/mp3'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.pptx')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Upload PowerPoint/PDF files and extract slides
app.post('/api/upload/slides', upload.single('presentation'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const processor = new PPTXProcessor();
    const slides = await processor.extractSlides(req.file.path, req.file.originalname);
    
    res.json({
      success: true,
      slides,
      message: `Successfully extracted ${slides.length} slides`
    });
  } catch (error) {
    console.error('Slide extraction error:', error);
    res.status(500).json({ 
      error: 'Failed to process presentation file',
      details: error.message 
    });
  }
});

// Upload audio files
app.post('/api/upload/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const processor = new AudioProcessor();
    const audioData = await processor.processAudio(req.file.path);
    
    res.json({
      success: true,
      audio: {
        url: `/uploads/${path.basename(req.file.path)}`,
        duration: audioData.duration,
        format: audioData.format,
        filename: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Audio processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process audio file',
      details: error.message 
    });
  }
});

// Generate TTS audio from text
app.post('/api/tts/generate', async (req, res) => {
  try {
    const { text, voice = 'default', speed = 1.0 } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required for TTS generation' });
    }

    const processor = new AudioProcessor();
    const audioFile = await processor.generateTTS(text, { voice, speed });
    
    res.json({
      success: true,
      audio: {
        url: `/output/${path.basename(audioFile.path)}`,
        duration: audioFile.duration,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      }
    });
  } catch (error) {
    console.error('TTS generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate speech',
      details: error.message 
    });
  }
});

// Sync slides with audio timing
app.post('/api/sync/slides', async (req, res) => {
  try {
    const { slides, audioUrl, syncMethod = 'auto' } = req.body;
    
    if (!slides || !audioUrl) {
      return res.status(400).json({ error: 'Slides and audio URL are required' });
    }

    const processor = new AudioProcessor();
    const syncedSlides = await processor.syncSlidesWithAudio(slides, audioUrl, syncMethod);
    
    res.json({
      success: true,
      slides: syncedSlides,
      message: 'Slides synchronized with audio'
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync slides with audio',
      details: error.message 
    });
  }
});

// Generate presentation video
app.post('/api/generate/video', async (req, res) => {
  try {
    const { slides, audioUrl, options = {} } = req.body;
    
    if (!slides || !audioUrl) {
      return res.status(400).json({ error: 'Slides and audio are required' });
    }

    const generator = new VideoGenerator();
    const videoPath = await generator.createPresentationVideo(slides, audioUrl, options);
    
    res.json({
      success: true,
      video: {
        url: `/output/${path.basename(videoPath)}`,
        filename: `presentation-${Date.now()}.mp4`
      },
      message: 'Video generated successfully'
    });
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate video',
      details: error.message 
    });
  }
});

// Get project status and files
app.get('/api/projects/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const projectPath = path.join(__dirname, 'projects', projectId);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const projectData = await fs.readFile(
      path.join(projectPath, 'project.json'), 
      'utf-8'
    );
    
    res.json({
      success: true,
      project: JSON.parse(projectData)
    });
  } catch (error) {
    console.error('Project retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve project',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PowerPoint Automation API running on port ${PORT}`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`🎬 Output directory: ${path.join(__dirname, 'output')}`);
});

module.exports = app;