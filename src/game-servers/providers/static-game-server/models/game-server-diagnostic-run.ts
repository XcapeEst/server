import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MongooseDocument } from '@/utils/mongoose-document';
import { Expose, Transform, Type } from 'class-transformer';
import { DiagnosticCheck, diagnosticCheckSchema } from './diagnostic-check';
import { DiagnosticRunStatus } from './diagnostic-run-status';
import { TransformObjectId } from '@/shared/decorators/transform-object-id';

@Schema()
export class GameServerDiagnosticRun extends MongooseDocument {
  @Expose()
  @Transform(({ value, obj }) => value ?? obj._id?.toString())
  id?: string;

  @Transform(({ value }) => value.toISOString(), { toPlainOnly: true })
  @Prop({ default: () => new Date() })
  launchedAt?: Date;

  @TransformObjectId()
  @Prop({ required: true, type: Types.ObjectId, ref: 'StaticGameServer' })
  gameServer!: Types.ObjectId;

  @Type(() => DiagnosticCheck)
  @Prop({ required: true, type: [diagnosticCheckSchema], _id: false })
  checks!: DiagnosticCheck[];

  @Prop({ enum: DiagnosticRunStatus, default: DiagnosticRunStatus.pending })
  status!: DiagnosticRunStatus;

  getCheckByName(name: string) {
    return this.checks.find((check) => check.name === name);
  }
}

export type GameServerDiagnosticRunDocument = GameServerDiagnosticRun &
  Document;
export const gameServerDiagnosticRunSchema = SchemaFactory.createForClass(
  GameServerDiagnosticRun,
);
