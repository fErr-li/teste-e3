import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ReceberMensagemDto } from './dto/receber-mensagem.dto';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhook: WebhookService) {}

  @Post('mensagem')
  @HttpCode(200)
  async receber(@Body() dto: ReceberMensagemDto) {
    // Mensagem duplicada: 200 com corpo vazio.
    return (await this.webhook.receber(dto)) ?? undefined;
  }
}
