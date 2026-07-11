# Python API + built admin frontend
FROM node:20-alpine AS admin-build
WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json* ./
RUN npm install
COPY admin/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server ./server
COPY pipeline ./pipeline
COPY supabase ./supabase
COPY --from=admin-build /app/admin/dist ./admin/dist

EXPOSE 8000

CMD ["sh", "-c", "uvicorn server.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
