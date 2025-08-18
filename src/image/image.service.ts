import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProcessedImage } from 'src/database/image.entity';
import { MinioService } from 'src/minio/minio.service';
import { Repository } from 'typeorm';

@Injectable()
export class ImageService {
    constructor(
        @InjectRepository(ProcessedImage)
        private readonly db: Repository<ProcessedImage>,
        private readonly minio: MinioService
    ) {}

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
