import { Tf2ClassName } from '@/shared/models/tf2-class-name';

export enum RestrictionReason {
  accountNeedsReview = 'account needs review',
}

export interface Restriction {
  reason: RestrictionReason;
  gameClasses?: Tf2ClassName[]; // list of classes this player is restricted from playing
}
