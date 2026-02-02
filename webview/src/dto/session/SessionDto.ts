import { Type, Transform } from 'class-transformer';
import { AnyMessageDto } from '../message/MessageDto';
import { transformMessages } from '../../mappers/messageTransformer';

/**
 * Session metadata DTO
 */
export class SessionMetaDto {
  id!: string;
  title!: string;
  createdAt!: string;
  updatedAt!: string;
  messageCount!: number;
  projectPath?: string;
  gitBranch?: string;
}

/**
 * Full session DTO with metadata and messages
 */
export class SessionDto {
  @Type(() => SessionMetaDto)
  meta!: SessionMetaDto;

  @Transform(({ value }) => transformMessages(value))
  messages!: AnyMessageDto[];
}

/**
 * Session list response DTO
 */
export class SessionListResponseDto {
  @Type(() => SessionMetaDto)
  sessions!: SessionMetaDto[];
}
