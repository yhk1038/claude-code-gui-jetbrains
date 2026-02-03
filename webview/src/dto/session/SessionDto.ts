import { Type } from 'class-transformer';
import { AnyMessageDto } from '../message/MessageDto';
import { transformMessages } from '../../mappers/messageTransformer';
import { toTitle } from '../../mappers/sessionTransformer';
import { To, ToDate, Rename } from '../decorators';

/**
 * Session metadata DTO
 */
export class SessionMetaDto {
  @Rename('sessionId') id: string;
  @To('firstPrompt', toTitle) title: string;
  @ToDate('created') createdAt: Date;
  @ToDate('modified') updatedAt: Date;

  messageCount: number;
  projectPath?: string;
  gitBranch?: string;
  firstPrompt?: string;
}

/**
 * Full session DTO with metadata and messages
 */
export class SessionDto {
  @Type(() => SessionMetaDto) meta: SessionMetaDto;
  @To(transformMessages) messages: AnyMessageDto[];
}

/**
 * Session list response DTO
 */
export class SessionListResponseDto {
  @Type(() => SessionMetaDto)
  sessions: SessionMetaDto[];
}
