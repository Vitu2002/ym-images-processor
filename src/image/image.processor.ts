import { Process } from '@nestjs/bull';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import sharp from 'sharp';
import { B2Service } from 'src/backblaze/b2.service';
import { ProcessedImage } from 'src/database/image.entity';
import { MinioService } from 'src/minio/minio.service';
import { Repository } from 'typeorm';

@Processor('image-convert')
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

    @Process({ concurrency: parseInt(`${process.env.CONCURRENCY || '1'}`) || 1 })
    async process(job: Job<{ objKey: string }>) {
        const { objKey } = job.data;
        this.logger.log(`Converting ${objKey}`);
        const buffer = await this.minio.getCObject(objKey);
        const image = await sharp(buffer).toFormat('avif').toBuffer({ resolveWithObject: true });
        const fileName = `${objKey.split('.')[0]}.avif`;
        this.logger.log(`Uploading ${fileName}`);
        const res = await this.b2.upload(image.data, fileName, await this.b2.generateUploadUrl());
        const meta = this.db.create({
            b2Id: res.fileId,
            objKey,
            url: res.fileName,
            size: image.info.size,
            mimetype: image.info.format,
            status:
                res.action === 'start'
                    ? 'pending'
                    : res.action === 'upload'
                      ? 'success'
                      : res.action
        });

        await this.db.save(meta);
        return meta;
    }
}
