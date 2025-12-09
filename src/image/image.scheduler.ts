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
    private running = false;

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

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleCron() {
        if (this.running || Boolean(process.env.WORKER_ONLY)) return;
        this.logger.log(
            `Running scheduler for ${process.env.MINIO_BUCKET} bucket (limit ${this.CHUNK_SIZE || 1000})...`
        );
        const allowed = await this.checkForPendingJobs();
        if (!allowed) return;
        this.running = true;
        let added = 0;
        try {
            let reachedLimit = false;

            while (!reachedLimit) {
                const images = await this.minio.listImages();
                this.logger.log(`Found ${images.length} images`);

                for (const image of images) {
                    const alreadyAdded = await this.producer.checkForPendingJob(image);
                    if (alreadyAdded) continue;
                    await this.producer.addConversion(image);
                    added++;
                }

                if (images.length < this.CHUNK_SIZE || added >= this.CHUNK_SIZE)
                    reachedLimit = true;
            }

            if (added === 0) this.logger.warn('No images found to process');
        } finally {
            this.logger.log(`Added ${added} images to queue`);
            this.running = false;
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async logStatus() {
        const [waiting, active, failed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getFailedCount()
        ]);

        this.logger.log(`Queue status: waiting=${waiting}, active=${active}, failed=${failed}`);
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
