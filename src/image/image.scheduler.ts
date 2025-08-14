import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MinioService } from 'src/minio/minio.service';
import { ImageProducer } from './image.producer';

@Injectable()
export class ImageScheduler implements OnModuleInit {
    private readonly logger = new Logger(ImageScheduler.name);

    constructor(
        private readonly minio: MinioService,
        private readonly producer: ImageProducer
    ) {}

    async onModuleInit() {
        // Start run
        this.logger.log('Starting scheduler...');
        await this.handleCron();
    }

    @Cron(CronExpression.EVERY_HOUR)
    async handleCron() {
        this.logger.log('Running scheduler...');
        const images = await this.minio.listImages();
        this.logger.log(`Found ${images.length} images`);
        for (const image of images) {
            await this.producer.addConversion(image);
        }
    }
}
