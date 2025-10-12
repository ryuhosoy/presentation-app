# Node.js 18をベースイメージとして使用
FROM node:18-bullseye

# 作業ディレクトリを設定
WORKDIR /app

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
    && rm -rf /var/lib/apt/lists/*

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションのソースコードをコピー
COPY . .

# Next.jsアプリケーションをビルド
RUN npm run build

# ポート3000を公開
EXPOSE 3000

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=3000

# アプリケーションを起動
CMD ["npm", "start"]

