# ============================================
# ビルドステージ
# ============================================
FROM node:18-bullseye AS builder

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 全ての依存関係をインストール（ビルドに必要な開発依存関係を含む）
# 脆弱性警告を無視してビルドを続行
RUN npm install --no-audit --legacy-peer-deps

# アプリケーションのソースコードをコピー
COPY . .

# Next.jsアプリケーションをビルド
RUN npm run build

# ============================================
# 本番ステージ
# ============================================
FROM node:18-bullseye

# 必要なシステムパッケージとLibreOfficeをインストール
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-impress \
    imagemagick \
    poppler-utils \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 本番依存関係のみインストール
RUN npm install --only=production --no-audit --legacy-peer-deps

# 必要なディレクトリを事前に作成
RUN mkdir -p public/uploads public/output public/temp

# ビルドステージから必要なファイルをコピー
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# 必要なディレクトリのパーミッション設定
RUN chmod -R 755 public

# 非rootユーザーを作成して実行
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app

USER appuser

# ポート3000（Next.js）を公開
EXPOSE 3000

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ヘルスチェックを追加（起動猶予時間を長く設定）
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Next.jsアプリケーションを起動
CMD ["sh", "-c", "npm start"]
