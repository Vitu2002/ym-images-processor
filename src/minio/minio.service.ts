import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, S3Error } from 'minio';

@Injectable()
export class MinioService extends Client implements OnModuleInit {
    private readonly logger = new Logger(MinioService.name);
    private readonly BUCKET_NAME = process.env.MINIO_BUCKET || 'images';
    private readonly CHUNK_SIZE = parseInt(`${process.env.CHUNK_SIZE}` || '100');

    constructor() {
        super({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            accessKey: process.env.MINIO_ACCESS_KEY,
            secretKey: process.env.MINIO_SECRET_KEY
        });
    }

    async onModuleInit() {
        try {
            // Check if bucket exists, if not, create it
            const exists = await this.bucketExists(this.BUCKET_NAME);
            if (!exists) {
                this.logger.warn(`Bucket ${this.BUCKET_NAME} not found, creating...`);
                await this.makeBucket(this.BUCKET_NAME);
                this.logger.warn(`Bucket ${this.BUCKET_NAME} created`);
            } else {
                this.logger.log(`Bucket ${this.BUCKET_NAME} connected`);
            }
        } catch (err: unknown) {
            if (err instanceof S3Error) {
                this.logger.error(err.message);
            } else {
                this.logger.error(err);
            }

            // Exit process because can't grant access to bucket
            process.exit(1);
        }
    }

    // Generate presigned URL for object, valid for 7 days (default)
    async generateUrl(objKey: string) {
        return this.presignedGetObject(this.BUCKET_NAME, objKey);
    }

    public async listImages(startAfter?: string): Promise<string[]> {
        const objects: string[] = [];
        const stream = this.listObjectsV2(this.BUCKET_NAME, '', true, startAfter);
        return new Promise((res, rej) => {
            // Stop when chunk is full, or object has no name
            stream.on('data', obj => {
                if (objects.length < this.CHUNK_SIZE && obj.name) {
                    objects.push(obj.name);
                } else stream.destroy();
            });
            // Return objects when reach end or close of stream
            stream.on('end', () => res(objects));
            stream.on('close', () => res(objects));
            // Return error
            stream.on('error', rej);
        });
    }

    async getCObject(objectName: string): Promise<Buffer> {
        this.logger.log(`Downloading ${objectName}`);
        const stream = await this.getObject(this.BUCKET_NAME, objectName);
        const chunks: Buffer[] = [];
        return new Promise((res, rej) => {
            // Fill chunks
            stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
            // Return buffer when reach end
            stream.on('end', () => {
                res(Buffer.concat(chunks));
            });
            // Return error
            stream.on('error', rej);
        });
    }
}
