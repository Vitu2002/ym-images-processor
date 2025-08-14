import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProcessedImage } from 'src/database/image.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ImageService {
    constructor(
        @InjectRepository(ProcessedImage)
        private readonly db: Repository<ProcessedImage>
    ) {}

    async listAll() {
        return this.db.find();
    }

    async deleteByUUID(uuid: string) {
        return this.db.delete({ id: uuid });
    }
}
