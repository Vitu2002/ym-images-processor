import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { B2Service } from '../backblaze/b2.service';
import { ProcessedImage } from '../database/image.entity';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class ImageService {
    constructor(
        @InjectQueue('image-convert') private readonly queue: Queue,
        @InjectRepository(ProcessedImage)
        private readonly db: Repository<ProcessedImage>,
        private readonly minio: MinioService,
        private readonly b2: B2Service
    ) {}

    async status() {
        const redisStatus =
            (await (await this.queue.client).ping()) === 'PONG' ? 'connected' : 'error';
        const minioStatus = this.minio.getStatus();
        const B2Status = this.b2.getStatus();
        let code = 200;

        if (redisStatus !== 'connected') code = 500;
        if (minioStatus !== 'connected') code = 500;
        if (B2Status !== 'connected') code = 500;

        return {
            code,
            queue: redisStatus,
            minio: minioStatus,
            backblaze: B2Status
        };
    }

    async listAll() {
        return this.db.find();
    }

    async getByUUID(uuid: string) {
        return await this.db.findOne({ where: { id: uuid } });
    }

    async deleteByUUID(uuid: string) {
        const obj = await this.getByUUID(uuid);
        if (!obj) throw new NotFoundException('Image not found.');
        await this.minio.deleteImage(obj.objKey);
        return this.db.delete({ id: uuid });
    }
}
