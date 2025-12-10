import { Process } from '@nestjs/bull';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import path from 'path';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { B2Service } from '../backblaze/b2.service';
import { ProcessedImage } from '../database/image.entity';
import { MinioService } from '../minio/minio.service';

@Processor('image-convert', {
    concurrency: Number(process.env.CONCURRENCY || 5),
    limiter: { max: 10, duration: 1000 },
    lockDuration: 60000
})
export class ImageProcessor extends WorkerHost {
    private readonly logger = new Logger(ImageProcessor.name);
    private readonly MAX_PROCESSING_SECONDS =
        parseInt(`${process.env.MAX_PROCESSING_SECONDS || 600}`) || 600;

    constructor(
        @InjectRepository(ProcessedImage)
        private readonly db: Repository<ProcessedImage>,
        private readonly minio: MinioService,
        private readonly b2: B2Service
    ) {
        super();
        this.logger.log(`Image processor started with concurrency ${process.env.CONCURRENCY || 1}`);
    }

    @Process()
    async process(job: Job<{ objKey: string }>): Promise<any> {
        return this.hardTimeout(this._processor(job), this.MAX_PROCESSING_SECONDS * 1000);
    }

    private async _processor(job: Job<{ objKey: string }>) {
        try {
            const { objKey } = job.data;
            this.logger.log(`Processing manhwa page: ${objKey}`);

            const buffer = await this.minio.getCObject(objKey);

            // 1. Pega metadados sem carregar a imagem inteira
            const metadata = await sharp(buffer).metadata();
            const origWidth = metadata.width ?? 0;
            const origHeight = metadata.height ?? 0;
            const maxSide = Math.max(origWidth, origHeight);

            this.logger.log(`Original size: ${origWidth}×${origHeight} (max side: ${maxSide}px)`);

            const needsResize = maxSide > 16300;
            const targetMaxSide = 16300;

            let pipeline = sharp(buffer, {
                sequentialRead: true,
                limitInputPixels: false,
                failOn: 'truncated'
            })
                .rotate()
                .withMetadata();

            if (needsResize) {
                this.logger.warn(
                    `Imagem muito alta/larga (${maxSide}px) → resize mantendo aspect ratio para ${targetMaxSide}px no lado maior`
                );

                pipeline = pipeline.resize({
                    [origWidth > origHeight ? 'width' : 'height']: targetMaxSide,
                    fit: 'contain',
                    withoutEnlargement: true,
                    kernel: 'lanczos3'
                });
            }

            pipeline = pipeline.avif({
                quality: 75,
                effort: 6,
                chromaSubsampling: '4:2:0',
                bitdepth: 8
            });

            const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

            const dirName = path.dirname(objKey);
            const baseName = path.basename(objKey, path.extname(objKey));
            const fileName = path.join(dirName, `${baseName}.avif`);

            this.logger.log(`Upload ${fileName} (${info.width}×${info.height}, ${info.format})`);

            const res = await this.b2.upload(data, fileName, await this.b2.generateUploadUrl());

            const meta = this.db.create({
                b2Id: res.fileId,
                objKey,
                url: res.fileName,
                size: data.length,
                mimetype: 'image/avif',
                status: 'success'
            });

            await this.db.save(meta);
            this.logger.log(`Success ${fileName}`);

            return meta;
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Unknown error';
            const errStack = err instanceof Error ? err.stack : 'Unknown stack';

            this.logger.error(`Job ${job.id} failed: ${errMessage}`, errStack);

            await this.db.save(
                this.db.create({
                    objKey: job.data.objKey,
                    status: 'error'
                })
            );

            throw new Error(JSON.stringify({ message: errMessage, stack: errStack }));
        }
    }

    private async hardTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = setTimeout(() => {
                reject(new Error(`Jot timeouted after ${ms}ms`));
            }, ms);

            promise
                .then(resolve)
                .catch(reject)
                .finally(() => clearTimeout(id));
        });
    }
}
