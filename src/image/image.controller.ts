import { Body, Controller, Delete, Get, Param, UnauthorizedException } from '@nestjs/common';
import { DeleteImageDTO } from './image.dto';
import { ImageService } from './image.service';

@Controller('image')
export class ImageController {
    constructor(private readonly manager: ImageService) {}

    @Get()
    async listAll() {
        return this.manager.listAll();
    }

    @Delete(':uuid')
    async deleteByUUID(@Param('uuid') uuid: string, @Body() { auth }: DeleteImageDTO) {
        if (auth !== process.env.API_SECRET) throw new UnauthorizedException('Unauthorized');
        return this.manager.deleteByUUID(uuid);
    }
}
