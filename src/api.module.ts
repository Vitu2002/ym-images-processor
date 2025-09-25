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
            connection: { url: process.env.REDIS_URI }
        }),
        ScheduleModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            autoLoadEntities: true,
            synchronize: true
        }),
        ImageModule
    ]
})
export class ApiModule {}
