FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 题池已由仓库内 public/arc_pool_*.json 提供；build:pools 依赖上一级的 ARC-AGI 数据目录，
# Docker 内不存在该路径，若在镜像里跑 build:pools 会报错。更新题池请在本地执行 npm run build:pools 后提交 public/。
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
