import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageModule } from './image/image.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        BullModule.forRoot({
            prefix: 'ym-img-processor',
            connection: { url: process.env.REDIS_URI },
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
        ScheduleModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            autoLoadEntities: true,
            synchronize: true
        }),
        ImageModule,
        BullBoardModule.forRoot({
            route: '/queues',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            adapter: ExpressAdapter
        })
    ]
})
export class ApiModule {}
