/**
 * @fileoverview Character Import Service for importing PNG and JSON character cards.
 * @module @services/CharacterImportService
 */

import type { 
  Character, 
  CharacterCardV2, 
  CharacterSpec, 
  CharacterExtensions,
  ImportCharacterResult 
} from '../db/characterTypes';
import { characterDb } from '../db/CharacterDatabase';

/**
 * Character Import Service
 */
export class CharacterImportService {
  /**
   * Import a character from a file (PNG or JSON)
   */
  async importFromFile(file: File): Promise<ImportCharacterResult> {
    try {
      console.log('Importing file:', file.name, 'type:', file.type);
      
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        return await this.importFromJSON(file);
      } else if (file.type.startsWith('image/') || file.name.endsWith('.png')) {
        return await this.importFromPNG(file);
      } else {
        return {
          success: false,
          error: 'Unsupported file type. Please upload a PNG or JSON file.',
        };
      }
    } catch (error) {
      console.error('Import error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during import',
      };
    }
  }

  /**
   * Import character from JSON file
   */
  private async importFromJSON(file: File): Promise<ImportCharacterResult> {
    const text = await file.text();
    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: 'Invalid JSON file',
      };
    }

    // Check if it's a CharacterVault export first (has id, name, data structure)
    if (this.isCharacterVaultExport(data)) {
      const character = await this.createCharacterFromExport(data as Character);
      return {
        success: true,
        character,
      };
    }

    // Handle v3 spec format (spec: "chara_card_v3", spec_version: "3.0", data: {...})
    const v3Data = this.extractV3Data(data);
    if (v3Data) {
      const character = await this.createCharacterFromV2(v3Data, '');
      return {
        success: true,
        character,
      };
    }

    // Check if it's a character card v2 (flat structure)
    if (this.isCharacterCardV2(data)) {
      // Properly extract all fields including v3 fields that may be present
      const cardData = data as unknown as Record<string, unknown>;
      const card: CharacterCardV2 = {
        name: String(cardData.name || ''),
        description: String(cardData.description || ''),
        personality: String(cardData.personality || ''),
        scenario: String(cardData.scenario || ''),
        first_mes: String(cardData.first_mes || ''),
        mes_example: String(cardData.mes_example || ''),
        system_prompt: String(cardData.system_prompt || ''),
        post_history_instructions: String(cardData.post_history_instructions || ''),
        alternate_greetings: Array.isArray(cardData.alternate_greetings) ? cardData.alternate_greetings : [],
        extensions: (cardData.extensions as CharacterExtensions) || {},
        character_book: cardData.character_book as import('../db/characterTypes').CharacterBook | undefined,
        // V3 fields - may be present in v2 files too
        creator: typeof cardData.creator === 'string' ? cardData.creator : undefined,
        character_version: typeof cardData.character_version === 'string' ? cardData.character_version : undefined,
        tags: Array.isArray(cardData.tags) ? cardData.tags : undefined,
        creator_notes: typeof cardData.creator_notes === 'string' ? cardData.creator_notes : undefined,
        avatar: typeof cardData.avatar === 'string' ? cardData.avatar : undefined,
      };
      const character = await this.createCharacterFromV2(card, '');
      return {
        success: true,
        character,
      };
    }

    return {
      success: false,
      error: 'Unrecognized JSON format. Expected Character Card V2, V3, or CharacterVault export.',
    };
  }

  /**
   * Extract v3 spec data from the nested structure
   * Returns null if not a v3 format
   * Handles hybrid structures where fields may be in both outer and inner objects
   */
  private extractV3Data(data: unknown): CharacterCardV2 | null {
    if (!data || typeof data !== 'object') return null;
    
    const outer = data as Record<string, unknown>;
    
    // For v3, we need the nested data object (or we can accept flat structure too)
    const inner = (outer.data && typeof outer.data === 'object') 
      ? outer.data as Record<string, unknown> 
      : null;
    
    // Must have a name to be valid (check both inner and outer)
    const name = (inner && typeof inner.name === 'string') ? inner.name 
               : typeof outer.name === 'string' ? outer.name 
               : null;
    
    if (!name) {
      return null;
    }

    // Helper to get value from inner or outer data
    const getString = (key: string, altKey?: string): string => {
      const val = (inner && typeof inner[key] === 'string') ? inner[key] 
                  : typeof outer[key] === 'string' ? outer[key] 
                  : altKey && inner && typeof inner[altKey] === 'string' ? inner[altKey]
                  : altKey && typeof outer[altKey] === 'string' ? outer[altKey]
                  : '';
      return String(val || '');
    };

    const getArray = (key: string): string[] | undefined => {
      const val = (inner && Array.isArray(inner[key])) ? inner[key] 
                  : Array.isArray(outer[key]) ? outer[key] 
                  : undefined;
      return val as string[] | undefined;
    };

    // Build CharacterCardV2 from v3 data structure
    // Check both inner (data) and outer levels for fields
    const card: CharacterCardV2 = {
      name: name,
      description: getString('description'),
      personality: getString('personality'),
      scenario: getString('scenario'),
      first_mes: getString('first_mes'),
      mes_example: getString('mes_example'),
      system_prompt: getString('system_prompt'),
      post_history_instructions: getString('post_history_instructions'),
      alternate_greetings: getArray('alternate_greetings') || [],
      extensions: (inner && inner.extensions as CharacterExtensions) || 
                  outer.extensions as CharacterExtensions || {},
      character_book: (inner && inner.character_book as import('../db/characterTypes').CharacterBook) || 
                      outer.character_book as import('../db/characterTypes').CharacterBook,
      // V3 fields - check both inner and outer, with alternative field names
      creator: getString('creator') || undefined,
      character_version: getString('character_version', 'create_date') || undefined,
      tags: getArray('tags'),
      creator_notes: getString('creator_notes', 'creatorcomment') || undefined,
      avatar: getString('avatar') || undefined,
    };
    return card;
  }

  /**
   * Import character from PNG file (with tEXt chunk)
   */
  private async importFromPNG(file: File): Promise<ImportCharacterResult> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      const charaData = this.extractCharaFromPNG(arrayBuffer);

      if (!charaData) {
        return {
          success: false,
          error: 'No character data found in PNG. Make sure this is a valid character card.',
        };
      }

      // Decode base64 character data
      let characterData: unknown;
      try {
        // atob() returns a binary string, but the data is UTF-8 encoded
        // We need to convert it properly to handle special characters
        const binaryString = atob(charaData);
        
        // Convert binary string to Uint8Array
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Decode as UTF-8 to properly handle special characters
        const decoded = new TextDecoder('utf-8').decode(bytes);
        characterData = JSON.parse(decoded);
      } catch (e) {
        console.error('Failed to decode/parse character data:', e);
        return {
          success: false,
          error: 'Invalid character data in PNG file',
        };
      }

      // Convert to image data URL
      const imageData = await this.fileToDataURL(file);

      // Try v3 extraction first (handles both nested v3 and flat v2 with v3 fields)
      const v3Data = this.extractV3Data(characterData);
      if (v3Data) {
        const character = await this.createCharacterFromV2(v3Data, imageData);
        return {
          success: true,
          character,
        };
      }

      // Handle nested format (chara_card_v3 has spec, spec_version, data structure)
      let actualData = characterData;
      if (characterData && typeof characterData === 'object') {
        const outerData = characterData as Record<string, unknown>;
        // Check if there's a nested 'data' property
        if (outerData.data && typeof outerData.data === 'object') {
          actualData = outerData.data;
        }
      }

      // Create character from V2 format (flat structure with optional v3 fields)
      if (this.isCharacterCardV2(actualData)) {
        // Cast and include v3 fields that might be present
        const cardData = actualData as unknown as Record<string, unknown>;
        const card: CharacterCardV2 = {
          name: String(cardData.name || ''),
          description: String(cardData.description || ''),
          personality: String(cardData.personality || ''),
          scenario: String(cardData.scenario || ''),
          first_mes: String(cardData.first_mes || ''),
          mes_example: String(cardData.mes_example || ''),
          system_prompt: String(cardData.system_prompt || ''),
          post_history_instructions: String(cardData.post_history_instructions || ''),
          alternate_greetings: Array.isArray(cardData.alternate_greetings) ? cardData.alternate_greetings : [],
          extensions: (cardData.extensions as CharacterExtensions) || {},
          character_book: cardData.character_book as import('../db/characterTypes').CharacterBook | undefined,
          // V3 fields - may be present in v2 files too
          creator: typeof cardData.creator === 'string' ? cardData.creator : undefined,
          character_version: typeof cardData.character_version === 'string' ? cardData.character_version : undefined,
          tags: Array.isArray(cardData.tags) ? cardData.tags : undefined,
          creator_notes: typeof cardData.creator_notes === 'string' ? cardData.creator_notes : undefined,
          avatar: typeof cardData.avatar === 'string' ? cardData.avatar : undefined,
        };
        const character = await this.createCharacterFromV2(card, imageData);
        return {
          success: true,
          character,
        };
      }

      // Try to extract data even if format doesn't match perfectly
      if (actualData && typeof actualData === 'object') {
        const data = actualData as Record<string, unknown>;
        
        // Try to get name from various possible locations
        const name = typeof data.name === 'string' ? data.name : 
                    typeof data.char_name === 'string' ? data.char_name :
                    'Imported Character';
        
        // Create a basic character with whatever data we can find
        const extractedSpec: CharacterSpec = {
          name: name,
          description: String(data.description || data.char_persona || ''),
          personality: String(data.personality || ''),
          scenario: String(data.scenario || data.world_scenario || ''),
          first_mes: String(data.first_mes || data.first_message || ''),
          mes_example: String(data.mes_example || ''),
          system_prompt: String(data.system_prompt || ''),
          post_history_instructions: String(data.post_history_instructions || ''),
          alternate_greetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [],
          physical_description: String(data.physical_description || ''),
          // V3 fields
          creator: typeof data.creator === 'string' ? data.creator : undefined,
          character_version: typeof data.character_version === 'string' ? data.character_version : undefined,
          tags: Array.isArray(data.tags) ? data.tags : undefined,
          creator_notes: typeof data.creator_notes === 'string' ? data.creator_notes : undefined,
          avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
        };

        const character = await characterDb.createCharacter({
          name: name,
          imageData,
          data: {
            spec: extractedSpec,
            characterBook: data.character_book as import('../db/characterTypes').CharacterBook | undefined,
            extensions: data.extensions as import('../db/characterTypes').CharacterExtensions | undefined,
          },
        });

        return {
          success: true,
          character,
        };
      }

      return {
        success: false,
        error: 'Invalid character card format in PNG',
      };
    } catch (error) {
      console.error('PNG import error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error reading PNG file',
      };
    }
  }

  /**
   * Extract character data from PNG chunks
   */
  private extractCharaFromPNG(arrayBuffer: ArrayBuffer): string | null {
    const dataView = new DataView(arrayBuffer);
    let offset = 0;

    // Check PNG signature
    const signature = new Uint8Array(arrayBuffer, 0, 8);
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) {
      if (signature[i] !== pngSignature[i]) {
        console.error('Invalid PNG signature');
        throw new Error('Invalid PNG file signature');
      }
    }
    offset = 8;

    // Read chunks
    while (offset < arrayBuffer.byteLength) {
      // Check if we have enough bytes to read the length and type
      if (offset + 8 > arrayBuffer.byteLength) {
        break;
      }

      const length = dataView.getUint32(offset);
      const type = this.readChunkType(dataView, offset + 4);
      
      // Sanity check on length
      if (length > 10 * 1024 * 1024) { // Max 10MB chunk
        console.error('Chunk too large:', length);
        break;
      }

      // Check if we have enough bytes for this chunk
      if (offset + 12 + length > arrayBuffer.byteLength) {
        console.error('Incomplete chunk at offset:', offset);
        break;
      }

      const chunkData = new Uint8Array(arrayBuffer, offset + 8, length);

      // Check for tEXt chunk with 'chara' keyword
      if (type === 'tEXt') {
        const keyword = this.readNullTerminatedString(chunkData);
        if (keyword === 'chara') {
          // Extract the data after the null byte
          const keywordBytes = new TextEncoder().encode(keyword);
          const dataBytes = chunkData.slice(keywordBytes.length + 1);
          const text = new TextDecoder().decode(dataBytes);
          return text;
        }
      }

      // Check for iTXt chunk (international text, might be compressed)
      if (type === 'iTXt') {
        const result = this.parseITXtChunk(chunkData);
        if (result.keyword === 'chara') {
          return result.text;
        }
      }

      // Check for IEND (end of PNG)
      if (type === 'IEND') {
        break;
      }

      offset += 12 + length; // 4 (length) + 4 (type) + length + 4 (CRC)
    }

    return null;
  }

  /**
   * Read chunk type as string
   */
  private readChunkType(dataView: DataView, offset: number): string {
    const bytes = [
      dataView.getUint8(offset),
      dataView.getUint8(offset + 1),
      dataView.getUint8(offset + 2),
      dataView.getUint8(offset + 3),
    ];
    return String.fromCharCode(...bytes);
  }

  /**
   * Read null-terminated string from byte array
   */
  private readNullTerminatedString(data: Uint8Array): string {
    let endIndex = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0) {
        endIndex = i;
        break;
      }
    }
    return new TextDecoder('utf-8').decode(data.slice(0, endIndex));
  }

  /**
   * Parse iTXt chunk (international text)
   */
  private parseITXtChunk(data: Uint8Array): { keyword: string; text: string } {
    let offset = 0;
    
    // Read keyword (null-terminated)
    let keywordEnd = offset;
    while (keywordEnd < data.length && data[keywordEnd] !== 0) {
      keywordEnd++;
    }
    const keyword = new TextDecoder('utf-8').decode(data.slice(offset, keywordEnd));
    offset = keywordEnd + 1;
    
    if (offset >= data.length) {
      return { keyword, text: '' };
    }
    
    // Read compression flag
    const compressionFlag = data[offset];
    offset++;
    
    // Skip compression method
    offset++;
    
    // Skip language tag (null-terminated)
    while (offset < data.length && data[offset] !== 0) {
      offset++;
    }
    offset++;
    
    // Skip translated keyword (null-terminated)
    while (offset < data.length && data[offset] !== 0) {
      offset++;
    }
    offset++;
    
    // Read text
    const text = new TextDecoder('utf-8').decode(data.slice(offset));
    
    // Decompress if needed
    if (compressionFlag === 1) {
      try {
        // Try to decompress using zlib
        const compressed = new Uint8Array(data.slice(offset));
        const decompressed = this.inflate(compressed);
        return { keyword, text: new TextDecoder().decode(decompressed) };
      } catch (e) {
        console.warn('Failed to decompress iTXt chunk:', e);
        return { keyword, text };
      }
    }
    
    return { keyword, text };
  }

  /**
   * Simple zlib inflate (for compressed PNG chunks)
   * This is a simplified version - real implementation would need zlib library
   */
  private inflate(data: Uint8Array): Uint8Array {
    // For now, just return the data as-is
    // Real implementation would use pako or similar library
    return data;
  }

  /**
   * Convert file to data URL
   */
  private fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Check if data is a Character Card V2
   */
  private isCharacterCardV2(data: unknown): data is CharacterCardV2 {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    // Be more lenient - just check for name field
    return typeof d.name === 'string';
  }

  /**
   * Check if data is a CharacterVault export
   */
  private isCharacterVaultExport(data: unknown): data is Character {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return typeof d.id === 'string' && typeof d.name === 'string' && d.data !== undefined;
  }

  /**
   * Create character from V2/V3 format
   */
  private async createCharacterFromV2(data: CharacterCardV2, imageData: string): Promise<Character> {
    const spec: CharacterSpec = {
      name: data.name || '',
      description: data.description || '',
      personality: data.personality || '',
      scenario: data.scenario || '',
      first_mes: data.first_mes || '',
      mes_example: data.mes_example || '',
      system_prompt: data.system_prompt || '',
      post_history_instructions: data.post_history_instructions || '',
      alternate_greetings: data.alternate_greetings || [],
      physical_description: '',
      // V3 spec fields
      avatar: data.avatar,
      creator_notes: data.creator_notes,
      creator: data.creator,
      character_version: data.character_version,
      tags: data.tags,
    };

    const character = await characterDb.createCharacter({
      name: data.name || 'Imported Character',
      imageData,
      data: {
        spec,
        characterBook: data.character_book,
        extensions: data.extensions,
      },
    });

    return character;
  }

  /**
   * Create character from CharacterVault export
   */
  private async createCharacterFromExport(data: Character): Promise<Character> {
    // Create a new character with the same data but new ID
    const character = await characterDb.createCharacter({
      name: data.name,
      imageData: data.imageData,
      data: data.data,
    });

    return character;
  }
}

/**
 * Singleton instance
 */
export const characterImportService = new CharacterImportService();
