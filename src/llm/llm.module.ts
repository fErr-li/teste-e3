import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER } from './interfaces/llm-provider.interface';
import { MockLlmProvider } from './providers/mock-llm.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

@Module({
  providers: [
    MockLlmProvider,
    OpenAiCompatibleProvider,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, MockLlmProvider, OpenAiCompatibleProvider],
      useFactory: (config: ConfigService, mock: MockLlmProvider, openai: OpenAiCompatibleProvider) =>
        config.get<string>('llm.provider') === 'mock' ? mock : openai,
    },
  ],
  exports: [LLM_PROVIDER, MockLlmProvider],
})
export class LlmModule {}
