import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IntervencaoDto } from './dto/intervencao.dto';
import { IntervencaoService } from './intervencao.service';

@Controller('intervencao')
export class IntervencaoController {
  constructor(private readonly intervencao: IntervencaoService) {}

  @Post()
  @HttpCode(200)
  executar(@Body() dto: IntervencaoDto): boolean {
    return this.intervencao.executar(dto);
  }
}
