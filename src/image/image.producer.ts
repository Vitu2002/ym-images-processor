import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class ImageProducer {
    constructor(@InjectQueue('image-convert') private readonly queue: Queue) {}

    async addConversion(objKey: string) {
        await this.queue.add('process-image', { objKey }, { jobId: objKey });
    }

    async checkForPendingJob(objKey: string) {
        return await this.queue.getJob(objKey);
    }
}
