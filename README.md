# 🎬 AI Presentation Video Generator

PowerPointプレゼンテーションから自動的にAI音声付き動画を生成するNext.jsアプリケーションです。

## ✨ 主な機能

### 📊 PowerPoint解析
- **直接PPTX解析**: JSZipを使用してPowerPointファイルから直接テキストを抽出
- **サーバーサイド画像変換**: 高品質なスライド画像を生成
- **テキスト・画像統合**: 抽出したテキストと画像を自動的に統合

### 🤖 AI機能
- **OpenAI GPT**: スライド内容を分析して自然なプレゼンテーションスクリプトを生成
- **ElevenLabs TTS**: 高品質な音声合成でスクリプトを読み上げ
- **コンテンツ分析**: スライドの内容を自動分析してスタイルを最適化

### 🎥 動画生成
- **FFmpeg統合**: スライド画像と音声を組み合わせてMP4動画を生成
- **正確な同期**: 音声の実際の長さに基づいてスライドタイミングを調整
- **プログレス表示**: リアルタイムで生成進捗を表示

### 🎨 ユーザーインターフェース
- **モダンUI**: Tailwind CSS + Radix UIによる美しいインターフェース
- **リアルタイムプレビュー**: スライドと音声をリアルタイムで確認
- **レスポンシブデザイン**: デスクトップ・モバイル対応

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# OpenAI API Configuration (必須 - AIスクリプト生成用)
OPENAI_API_KEY=your_openai_api_key_here

# ElevenLabs API Configuration (必須 - 音声生成用)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Google Cloud (オプション - 音声認識の精度向上)
GOOGLE_CLOUD_PROJECT_ID=your_google_cloud_project_id
GOOGLE_CLOUD_PRIVATE_KEY=your_google_cloud_private_key
GOOGLE_CLOUD_CLIENT_EMAIL=your_google_cloud_client_email
```

### 3. 必要なシステム要件

動画生成機能を使用するには、以下が必要です：

#### FFmpeg
動画・音声ファイルの処理用

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Windows
# https://ffmpeg.org/download.html からダウンロード
```

### 4. APIキーの取得

#### OpenAI APIキー
1. [OpenAI Platform](https://platform.openai.com/)にアクセス
2. アカウントを作成またはログイン
3. APIキーを生成
4. `.env.local`ファイルに`OPENAI_API_KEY`として設定

#### ElevenLabs APIキー
1. [ElevenLabs](https://elevenlabs.io/)にアクセス
2. アカウントを作成またはログイン
3. APIキーを生成
4. `.env.local`ファイルに`ELEVENLABS_API_KEY`として設定

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスしてください。

## 📖 使用方法

### 1. スライドのアップロード
- PowerPointファイル（.pptx）をドラッグ&ドロップまたはクリックでアップロード
- スライドの画像とテキストが自動抽出される

### 2. AIスクリプト生成
- **プレゼンテーションスタイル**を選択：
  - プロフェッショナル
  - カジュアル
  - アカデミック
  - クリエイティブ
- **目標時間**を設定（3-20分）
- 「AIスクリプト生成」ボタンをクリック
- AIがスライド内容に基づいて最適なスクリプトを自動生成

### 3. 自動動画生成
- 「自動動画生成」ボタンをクリック
- 以下の処理が自動実行される：
  1. **AI音声生成**: ElevenLabs APIで各スライドの音声を生成
  2. **スライド同期**: 実際の音声時間に基づいてタイミングを調整
  3. **動画レンダリング**: FFmpegでスライドと音声を統合
  4. **MP4出力**: 最終的な動画ファイルを生成

### 4. 動画の確認とダウンロード
- 生成された動画をブラウザで直接再生
- MP4ファイルまたは音声ファイルをダウンロード

## 🏗️ アーキテクチャ

### フロントエンド
- **Next.js 13**: App Routerを使用したモダンなReactフレームワーク
- **TypeScript**: 型安全性を保証
- **Tailwind CSS**: ユーティリティファーストのCSS
- **Radix UI**: アクセシブルなUIコンポーネント

### バックエンド API
- **Next.js API Routes**: サーバーサイド処理
- **OpenAI API**: GPT-4を使用したスクリプト生成
- **ElevenLabs API**: 高品質な音声合成
- **FFmpeg**: 動画・音声処理

### ファイル処理
- **JSZip**: PowerPointファイルの直接解析
- **Canvas API**: スライド画像の生成とフォールバック
- **File System API**: 一時ファイルの管理

## 📁 プロジェクト構造

```
presentation-app/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── ai/                   # AI関連API
│   │   │   ├── generate-script/  # スクリプト生成
│   │   │   └── generate-video/   # 動画生成
│   │   ├── convert/              # ファイル変換
│   │   ├── tts/                  # 音声合成
│   │   └── upload/               # ファイルアップロード
│   ├── globals.css               # グローバルスタイル
│   ├── layout.tsx                # レイアウトコンポーネント
│   └── page.tsx                  # メインページ
├── components/                   # Reactコンポーネント
│   ├── ui/                       # UIコンポーネント
│   ├── AudioControls.tsx         # 音声コントロール
│   ├── FileUpload.tsx            # ファイルアップロード
│   ├── PresentationPlayer.tsx    # プレゼンテーション再生
│   └── SlideTimeline.tsx         # スライドタイムライン
├── lib/                          # ユーティリティ
│   ├── api-client.ts             # API クライント
│   ├── pptx-parser.ts            # PowerPoint解析
│   └── utils.ts                  # 共通ユーティリティ
├── public/                       # 静的ファイル
│   ├── converted/                # 変換済みファイル
│   ├── output/                   # 出力ファイル
│   └── uploads/                  # アップロードファイル
└── server/                       # サーバーサイド処理
    └── processors/               # ファイル処理
```

## 🔧 技術スタック

### Core Technologies
- **Next.js 13.5.1**: React フレームワーク
- **TypeScript 5.2.2**: 型安全性
- **React 18.2.0**: UIライブラリ

### AI & APIs
- **OpenAI GPT-4**: テキスト生成
- **ElevenLabs**: 音声合成
- **Google Cloud** (オプション): 音声認識

### UI & Styling
- **Tailwind CSS 3.3.3**: スタイリング
- **Radix UI**: UIコンポーネント
- **Lucide React**: アイコン

### File Processing
- **JSZip 3.10.1**: ZIP/PPTX解析
- **FFmpeg**: 動画・音声処理
- **Canvas API**: 画像生成

### Development Tools
- **ESLint**: コード品質
- **PostCSS**: CSS処理
- **Autoprefixer**: ブラウザ互換性

## 🎯 主要な機能詳細

### PowerPoint解析エンジン
```typescript
// lib/pptx-parser.ts
export class PPTXParser {
  // 直接PPTX解析でテキストと画像を抽出
  async parsePPTX(file: File): Promise<SlideData[]>
  
  // サーバーサイド画像変換
  private async convertToImagesAndExtract(file: File)
  
  // テキスト抽出
  private async extractTextFromPPTX(file: File)
}
```

### AI動画生成API
```typescript
// app/api/ai/generate-video/route.ts
export async function POST(request: NextRequest) {
  // 1. 各スライドのスクリプトから音声生成
  // 2. 実際の音声時間でスライド同期
  // 3. FFmpegで動画レンダリング
  // 4. MP4ファイル出力
}
```

## 🚨 トラブルシューティング

### よくある問題

#### 1. FFmpegが見つからない
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

#### 2. APIキーエラー
- `.env.local`ファイルが正しく設定されているか確認
- APIキーが有効で、適切な権限があるか確認

#### 3. メモリ不足エラー
- 大きなPowerPointファイルの場合、Node.jsのメモリ制限を増やす：
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

#### 4. ビルドエラー
```bash
# キャッシュをクリア
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

## 📊 パフォーマンス最適化

### 推奨設定
- **スライド数**: 20枚以下を推奨
- **ファイルサイズ**: 50MB以下を推奨
- **動画時間**: 10分以下を推奨

### 最適化のヒント
1. **画像圧縮**: スライド内の画像を事前に圧縮
2. **テキスト最適化**: 簡潔で明確なテキストを使用
3. **音声品質**: 必要に応じて音声品質を調整

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🙏 謝辞

- [OpenAI](https://openai.com/) - GPT-4 API
- [ElevenLabs](https://elevenlabs.io/) - 音声合成API
- [Next.js](https://nextjs.org/) - Reactフレームワーク
- [Tailwind CSS](https://tailwindcss.com/) - CSSフレームワーク
- [Radix UI](https://www.radix-ui.com/) - UIコンポーネント
- [FFmpeg](https://ffmpeg.org/) - 動画処理

---

## 🔗 関連リンク

- [デモサイト](http://localhost:3000)
- [OpenAI API ドキュメント](https://platform.openai.com/docs)
- [ElevenLabs API ドキュメント](https://docs.elevenlabs.io/)
- [Next.js ドキュメント](https://nextjs.org/docs)

**Made with ❤️ and AI**