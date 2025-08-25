import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { B2Module } from 'src/backblaze/b2.module';
import { ProcessedImage } from 'src/database/image.entity';
import { MinioModule } from 'src/minio/minio.module';
import { ImageController } from './image.controller';
import { ImageProcessor } from './image.processor';
import { ImageProducer } from './image.producer';
import { ImageScheduler } from './image.scheduler';
import { ImageService } from './image.service';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'image-convert',
            defaultJobOptions: {
                attempts: 3
            }
        }),
        TypeOrmModule.forFeature([ProcessedImage]),
        MinioModule,
        B2Module
    ],
    providers: [ImageScheduler, ImageProcessor, ImageProducer, ImageService],
    controllers: [ImageController],
    exports: [ImageService]
})
export class ImageModule {}
