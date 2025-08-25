import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { MinioService } from 'src/minio/minio.service';
import { ImageProducer } from './image.producer';

@Injectable()
export class ImageScheduler implements OnModuleInit {
    private readonly logger = new Logger(ImageScheduler.name);
    private readonly CHUNK_SIZE = parseInt(`${process.env.CHUNK_SIZE}` || '100');

    constructor(
        @InjectQueue('image-convert') private readonly queue: Queue,
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
        const allowed = await this.checkForPendingJobs();
        if (!allowed) return;
        const images = await this.minio.listImages();
        this.logger.log(`Found ${images.length} images`);
        for (const image of images) {
            await this.producer.addConversion(image);
        }
    }

    async checkForPendingJobs() {
        const waiting = await this.queue.getWaitingCount();
        const limit = Math.floor(this.CHUNK_SIZE / 2);

        if (waiting > limit) {
            this.logger.warn(`There are ${waiting} jobs waiting, skipping...`);
            return false;
        }
        return true;
    }
}
