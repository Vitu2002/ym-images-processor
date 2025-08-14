# 📦 Yomu Image Processor

A horizontally scalable image processing service built with **NestJS**, **Sharp** and **BullMQ**. It
automatically pulls images from **MinIO**, converts them to **AVIF**, uploads them to **Backblaze
B2**, and stores metadata in a external db for easy retrieval.

> _While it’s built for Yomu services, it’s designed to be easily adapted to any S3-compatible
> storage._

## 🚀 Features

- **Pulls images from MinIO** in chunks (100/h).
- **Process images automaticaly** to "image/avif" _(heic)_ using **Sharp**.
- **Push images for Backblaze B2** (or easy adaptation for any S3-like storage).
- **Persistent metadata storage** to integrate with other apps.
- **Rest API** for:
- Fetch processed images data;
- Delete cached images by UUID when no longer needed.
- **Horizontal scalability** run how many workers as you need (or can).

---

## 🛠️ Tech Stack

- [Node.js](https://nodejs.org/) — Main language with a plus of
  [TypeScript](https://www.typescriptlang.org/) to ensure security.
- [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/) — job queue & worker orchestration.
- [Sharp](https://sharp.pixelplumbing.com/) — High performance image manipulation.
- [PostgreSQL](https://www.postgresql.org/) + [TypeORM](https://typeorm.io/) — metadata persistence.
- [MinIO SDK](https://docs.min.io/docs/javascript-client-api-reference.html) — S3-like object
  storage for source images.
- [Backblaze B2](https://backblaze.com) — S3-like object storage for target images.

---

## 📦 How it works

1. **Scheduler** picks up image chunks from MinIO.
2. **Jobs** are queued in Redis via BullMQ.
3. **Workers**:
    - Download image from MinIO.
    - Convert to AVIF with Sharp.
    - Upload to Backblaze B2.
    - Save metadata to the database.
4. **API** provides metadata access to other services.
5. **Other services** can delete cached entries when done.

---

## ⚙️ Running locally

```bash
# Clone the repo
git clone https://github.com/Vitu2002/ym-images-processor.git
cd ym-images-processor

# Install dependencies
yarn install

# Start Redis
docker run -d --name redis -p 6379:6379 redis

# Start MinIO
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minio \
  -e MINIO_ROOT_PASSWORD=minio123 \
  minio/minio server /data --console-address ":9001"

# Run dev mode
yarn start:dev
```

---

## 📡 API Endpoints

| Method | Endpoint      | Description                    |
| ------ | ------------- | ------------------------------ |
| GET    | `/images`     | Fetch processed image metadata |
| DELETE | `/images/:id` | Delete cached image entry\*    |

> \*Need send

---

## 🗄️ Environment Variables

| Name               | Description                     |
| ------------------ | ------------------------------- |
| `API_SECRET`       | Token to auth delete image      |
| `DATABASE_URL`     | PostgreSQL connection URI       |
| `REDIS_URI`        | Redis connection URI            |
| `MINIO_ENDPOINT`   | MinIO server host               |
| `MINIO_BUCKET`     | MinIO images bucket             |
| `MINIO_ACCESS_KEY` | MinIO access key                |
| `MINIO_SECRET_KEY` | MinIO secret key                |
| `B2_KEY`           | Backblaze B2 key ID             |
| `B2_SECRET`        | Backblaze B2 application key    |
| `B2_BUCKET`        | Backblaze B2 target bucket name |

---

## 🧩 Scaling

This service is **horizontally scalable**:

- The API is NestJS-based and stateless → run behind a load balancer.
- Workers are lightweight processes that listen to Redis queues → just run more containers to
  increase throughput.
- Persistent data in PostgreSQL ensures no duplication or loss.

---

## 📜 License

MIT – do whatever you want, just don’t blame me if you break the internet. Resumindo, só não saia do
planeta!
