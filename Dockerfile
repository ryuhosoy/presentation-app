# ============================================
# ビルドステージ
# ============================================
FROM node:18-bullseye AS builder

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 全ての依存関係をインストール（ビルドに必要な開発依存関係を含む）
RUN npm ci

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
RUN npm ci --only=production

# ビルドステージから必要なファイルをコピー
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

# サーバーファイルをコピー
COPY server ./server

# その他の必要なファイルをコピー
COPY components ./components
COPY lib ./lib
COPY app ./app

# 必要なディレクトリを作成
RUN mkdir -p server/uploads server/output server/projects && \
    chmod -R 755 server/uploads server/output server/projects

# 非rootユーザーを作成して実行
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app

USER appuser

# ポート3000（Next.js）と3001（Expressサーバー）を公開
EXPOSE 3000 3001

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=3000

# ヘルスチェックを追加
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 起動スクリプトを作成して両方のサーバーを起動
CMD ["sh", "-c", "node server/index.js & npm start"]
