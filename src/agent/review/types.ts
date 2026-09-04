import type { CharacterBook, CharacterSpec, LorebookEntry } from '../../db/characterTypes';
import type { CharacterAgentFieldId } from '../hosts/character/fields';

export interface CharacterReviewPayload {
  originalSpec: CharacterSpec;
  proposedSpec?: CharacterSpec;
  originalBook: CharacterBook;
  proposedBook?: CharacterBook;
}

export interface LorebookReviewPayload {
  originalBook: CharacterBook;
  proposedBook: CharacterBook;
}

export type AgentReviewChange =
  | { id: string; kind: 'field'; fieldId: CharacterAgentFieldId; label: string; before: string; after: string }
  | { id: string; kind: 'greeting'; index: number; before: string; after: string }
  | { id: string; kind: 'greetings'; before: string[]; after: string[] }
  | { id: string; kind: 'entry-added'; entryId: number; title: string; keys: string[]; content: string }
  | {
      id: string;
      kind: 'entry-updated';
      entryId: number;
      title: string;
      beforeContent: string;
      afterContent: string;
      beforeKeys: string[];
      afterKeys: string[];
      metaChanged: boolean;
    }
  | { id: string; kind: 'entry-deleted'; entryId: number; title: string; content: string }
  | { id: string; kind: 'book-settings'; summary: string[] };

export interface ReviewDecision {
  approved: boolean;
  edited?: string;
  editedKeys?: string[];
}

export type ReviewDecisions = Record<string, ReviewDecision>;

export interface AppliedCharacterReview {
  spec?: CharacterSpec;
  book?: CharacterBook;
}

export type { LorebookEntry };
