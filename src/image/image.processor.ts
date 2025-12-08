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
    limiter: { max: 20, duration: 1000 }
})
export class ImageProcessor extends WorkerHost {
    private readonly logger = new Logger(ImageProcessor.name);

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

            // 2. Define se vai precisar redimensionar (só se maior que 16300 px)
            const needsResize = maxSide > 16300;
            const targetMaxSide = 16300;

            let pipeline = sharp(buffer, {
                sequentialRead: true, // essencial pra imagens gigantes
                limitInputPixels: false,
                failOn: 'truncated'
            })
                .rotate() // corrige orientação EXIF (quase nunca tem em manhwa, mas não custa)
                .withMetadata();

            if (needsResize) {
                this.logger.warn(
                    `Imagem muito alta/larga (${maxSide}px) → resize mantendo aspect ratio para ${targetMaxSide}px no lado maior`
                );

                pipeline = pipeline.resize({
                    [origWidth > origHeight ? 'width' : 'height']: targetMaxSide,
                    fit: 'contain', // ← mantém proporção, não deforma NADA
                    withoutEnlargement: true, // nunca aumenta
                    kernel: 'lanczos3' // qualidade máxima no downscale
                });
            }
            // ← se não precisa redimensionar, passa direto (100% pixel perfect)

            // 3. Sempre tenta AVIF (agora é impossível dar erro de 16384)
            pipeline = pipeline.avif({
                quality: 75,
                effort: 6, // ótimo equilíbrio para tiras longas
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
            if (err instanceof Error) {
                const errMsg = err.message || 'Unknown error';
                this.logger.error(`Job ${job.id} failed: ${errMsg}`, err.stack);

                await this.db.save(
                    this.db.create({
                        objKey: job.data.objKey,
                        status: 'error'
                    })
                );
            }

            throw err;
        }
    }
}
