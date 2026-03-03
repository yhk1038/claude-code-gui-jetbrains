import { Type, Transform } from 'class-transformer';
import { AnyContentBlockDto } from './ContentBlockDto';
import { transformContentBlocks } from '../../mappers/contentBlockTransformer';
import { ContentBlockDeltaMessageDto } from '../stream/StreamEventDto';
import { MessageRole, LoadedMessageType } from '../common';

/**
 * User message payload containing role and content
 */
export class UserMessagePayloadDto {
  role: MessageRole = MessageRole.User;

  @Transform(({ value }) => transformContentBlocks(value))
  content!: string | AnyContentBlockDto[];
}

/**
 * User message from Claude CLI JSONL
 */
export class UserMessageDto {
  type: LoadedMessageType = LoadedMessageType.User;

  @Type(() => UserMessagePayloadDto)
  message!: UserMessagePayloadDto;

  timestamp!: string;
}

/**
 * Assistant message from Claude CLI JSONL
 */
export class AssistantMessageDto {
  type: LoadedMessageType = LoadedMessageType.Assistant;
  sessionId!: string;
  messageId!: string;

  @Transform(({ value }) => transformContentBlocks(value))
  content!: AnyContentBlockDto[];
}

/**
 * System message from Claude CLI JSONL (session initialization)
 */
export class SystemMessageDto {
  type: LoadedMessageType = LoadedMessageType.System;
  session_id!: string;
  timestamp!: string;
  content!: string;
}

/**
 * Result message from Claude CLI JSONL (completion)
 */
export class ResultMessageDto {
  type: LoadedMessageType = LoadedMessageType.Result;
  sessionId!: string;
  status!: 'success' | 'error';
  messageId?: string;

  @Type(() => UsageDto)
  usage?: UsageDto;

  @Type(() => ErrorDetailDto)
  error?: ErrorDetailDto;
}

/**
 * Token usage information
 */
export class UsageDto {
  input_tokens!: number;
  output_tokens!: number;
}

/**
 * Error detail information
 */
export class ErrorDetailDto {
  code!: string;
  message!: string;
  details?: Record<string, unknown>;
}

export type AnyMessageDto =
  | UserMessageDto
  | AssistantMessageDto
  | SystemMessageDto
  | ResultMessageDto;

/**
 * CLI 스트림에서 수신되는 메시지 타입 (세션 활성 중)
 */
export type SessionStreamMessageDto =
  | ContentBlockDeltaMessageDto
  | AssistantMessageDto
  | ResultMessageDto;
