import { Body, Controller, Delete, Get, Param, UnauthorizedException } from '@nestjs/common';
import { DeleteImageDTO } from './image.dto';
import { ImageService } from './image.service';

@Controller()
export class ImageController {
    constructor(private readonly manager: ImageService) {}

    @Get('health')
    async getHealth() {
        return await this.manager.status();
    }

    @Get('image')
    async listAll() {
        return this.manager.listAll();
    }

    @Delete('image/:uuid')
    async deleteByUUID(@Param('uuid') uuid: string, @Body() { auth }: DeleteImageDTO) {
        if (auth !== process.env.API_SECRET) throw new UnauthorizedException('Unauthorized');
        return this.manager.deleteByUUID(uuid);
    }
}
