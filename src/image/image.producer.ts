import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class ImageProducer {
    constructor(@InjectQueue('image-convert') private readonly queue: Queue) {}

    async addConversion(objKey: string) {
        // Add job to queue
        await this.queue.add(
            'process-image', // Queue name
            { objKey }, // Job data
            {
                jobId: objKey, // Job ID
                // Deduplication
                deduplication: {
                    id: objKey,
                    replace: true
                }
            }
        );
    }

    async checkForPendingJob(objKey: string) {
        return await this.queue.getJob(objKey);
    }
}
