import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { MinioService } from '../minio/minio.service';
import { ImageProducer } from './image.producer';

@Injectable()
export class ImageScheduler implements OnModuleInit {
    private readonly logger = new Logger(ImageScheduler.name);
    private readonly CHUNK_SIZE = parseInt(`${process.env.CHUNK_SIZE}` || '1000') || 1000;

    constructor(
        @InjectQueue('image-convert') private readonly queue: Queue,
        private readonly minio: MinioService,
        private readonly producer: ImageProducer
    ) {}

    async onModuleInit() {
        // Start run
        this.logger.log('Starting scheduler...');
        await this.handleCron();
        await this.logStatus();
    }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async handleCron() {
        this.logger.log(
            `Running scheduler for ${process.env.MINIO_BUCKET} bucket (limit ${this.CHUNK_SIZE || 1000})...`
        );
        const allowed = await this.checkForPendingJobs();
        if (!allowed) return;
        const images = await this.minio.listImages();
        this.logger.log(`Found ${images.length} images`);
        for (const image of images) {
            await this.producer.addConversion(image);
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async logStatus() {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount()
        ]);

        this.logger.log(
            `Queue status: waiting=${waiting}, active=${active}, completed=${completed}, failed=${failed}, delayed=${delayed}`
        );
    }

    async checkForPendingJobs() {
        const waiting = await this.queue.getWaitingCount();
        const limit = Math.floor(this.CHUNK_SIZE * 1.5); // Allow 50% more jobs than chunk size

        this.logger.log(`There are ${waiting} jobs waiting, limit is ${limit}`);

        if (waiting > limit) {
            this.logger.warn(`There are ${waiting} jobs waiting, skipping...`);
            return false;
        }
        return true;
    }
}
