import { Module } from '@nestjs/common';
import { FindAllAgentController } from './findall-agent.controller';
import { FindAllAgentService } from './services/findall-agent.service';

@Module({
  controllers: [FindAllAgentController],
  providers: [FindAllAgentService],
  exports: [FindAllAgentService],
})
export class FindAllAgentModule {}
