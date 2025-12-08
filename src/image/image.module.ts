import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { B2Module } from '../backblaze/b2.module';
import { ProcessedImage } from '../database/image.entity';
import { MinioModule } from '../minio/minio.module';
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
                attempts: 6,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                },
                removeOnComplete: { age: 86400, count: 1000 },
                removeOnFail: { age: 86400 * 14 }
            }
        }),
        BullBoardModule.forFeature({
            name: 'image-convert',
            adapter: BullMQAdapter
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
