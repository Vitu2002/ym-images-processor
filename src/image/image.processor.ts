import { Process } from '@nestjs/bull';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import path from 'path';
import sharp from 'sharp';
import { B2Service } from 'src/backblaze/b2.service';
import { ProcessedImage } from 'src/database/image.entity';
import { MinioService } from 'src/minio/minio.service';
import { Repository } from 'typeorm';

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

    @Process({ concurrency: parseInt(String(process.env.CONCURRENCY || '1'), 10) })
    async process(job: Job<{ objKey: string }>) {
        try {
            const { objKey } = job.data;
            this.logger.log(`Converting ${objKey}`);

            const buffer = await this.minio.getCObject(objKey);
            const { data, info } = await sharp(buffer, { limitInputPixels: false })
                .resize({ width: 1200, withoutEnlargement: true })
                .avif({ quality: 60, effort: 3 })
                .toBuffer({ resolveWithObject: true });

            const dirName = path.dirname(objKey);
            const baseName = path.basename(objKey, path.extname(objKey));
            const fileName = path.join(dirName, `${baseName}.avif`);

            this.logger.log(`Uploading ${fileName}`);
            const res = await this.b2.upload(data, fileName, await this.b2.generateUploadUrl());

            const meta = this.db.create({
                b2Id: res.fileId,
                objKey,
                url: res.fileName,
                size: data.length, // tamanho em bytes
                mimetype: `image/${info.format}`,
                status: res.action === 'upload' ? 'success' : 'pending'
            });

            await this.db.save(meta);
            return meta;
        } catch (err: any) {
            if (err instanceof Error)
                this.logger.error(`Failed to process job ${job.id}: ${err.message}`, err.stack);

            const meta = this.db.create({
                objKey: job.data.objKey,
                status: 'error'
            });
            await this.db.save(meta);

            throw err; // deixa o BullMQ marcar como failed
        }
    }
}
