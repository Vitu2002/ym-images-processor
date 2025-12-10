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
        // Only run on main process
        if (process.env.WORKER_ONLY == true || process.env.WORKER_ONLY == 'true') return;
        // Check if already running
        if (this.running) return this.logger.warn('Already running a image scheduler');
        else
            this.logger.log(
                `Running scheduler for ${process.env.MINIO_BUCKET} bucket (limit ${this.CHUNK_SIZE || 1000})...`
            );

        this.running = true;
        try {
            // Check if there are pending jobs in queue to avoid overloading (1.5x chunk size)
            if (!(await this.checkForPendingJobs())) return;
            // Get images path from minio
            const images = await this.minio.listPendingImages({ limit: this.CHUNK_SIZE });

            // Return if no images found
            if (images.length === 0) {
                this.logger.warn('No images found to process');
                return;
            }
            this.logger.log(`Found ${images.length} images`);

            // Add images to queue for processing (auto deduplication enabled)
            for (const image of images) {
                await this.producer.addConversion(image);
            }

            // End scheduler
            this.logger.log(`Added ${images.length} images to queue (deduplication enabled)`);
        } catch (err) {
            this.logger.error('Error running scheduler', err instanceof Error ? err.stack : err);
        } finally {
            this.running = false;
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async logStatus() {
        // Get queue status
        const [waiting, active, failed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getFailedCount()
        ]);

        // Log status
        this.logger.log(`Queue status: waiting=${waiting}, active=${active}, failed=${failed}`);
    }

    async checkForPendingJobs() {
        // Get queue pending count
        const waiting = await this.queue.getWaitingCount();
        const limit = Math.floor(this.CHUNK_SIZE * 1.5); // Allow 50% more jobs than chunk size

        this.logger.log(`There are ${waiting} jobs waiting, limit is ${limit}`);

        // Check if waiting is greater than limit
        if (waiting > limit) {
            this.logger.warn(`There are ${waiting} jobs waiting, skipping...`);
            return false;
        }
        return true;
    }
}
