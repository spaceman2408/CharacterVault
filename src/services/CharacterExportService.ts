/**
 * @fileoverview Character Export Service for exporting characters as PNG and JSON.
 * @module @services/CharacterExportService
 */

import type { Character, CharacterCardV2, ExportCharacterResult } from '../db/characterTypes';

/**
 * Character Export Service
 */
export class CharacterExportService {
  /**
   * Export character as JSON file (V3 format by default)
   */
  async exportAsJSON(character: Character): Promise<ExportCharacterResult> {
    try {
      const cardV3 = this.characterToV3(character);
      const json = JSON.stringify(cardV3, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      return {
        success: true,
        blob,
        filename: `${this.sanitizeFilename(character.name)}.json`,
      };
    } catch (error) {
      console.error('JSON export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error exporting character',
      };
    }
  }

  /**
   * Export character as JSON file (V2 format)
   */
  async exportAsV2(character: Character): Promise<ExportCharacterResult> {
    try {
      const cardV2 = this.characterToV2Full(character);
      const json = JSON.stringify(cardV2, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      return {
        success: true,
        blob,
        filename: `${this.sanitizeFilename(character.name)}_v2.json`,
      };
    } catch (error) {
      console.error('V2 JSON export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error exporting character',
      };
    }
  }

  /**
   * Export character as PNG with embedded character data.
   * Writes `chara` as wrapped V2 (`spec/spec_version/data`) for broad parser compatibility.
   */
  async exportAsPNG(character: Character): Promise<ExportCharacterResult> {
    try {
      if (!character.imageData) {
        return {
          success: false,
          error: 'Character has no image. Please add an image before exporting as PNG.',
        };
      }

      // Convert character data to base64 (Unicode-safe).
      // Keep PNG metadata shape aligned with common card parsers:
      // { spec: "chara_card_v2", spec_version: "2.0", data: { ... } }
      const cardV2 = this.characterToV2Full(character);
      const charaData = this.unicodeToBase64(JSON.stringify(cardV2));

      // Load the image
      const imageBlob = await this.dataURLToBlob(character.imageData);
      const arrayBuffer = await imageBlob.arrayBuffer();

      // Embed character data into PNG
      const pngWithMetadata = await this.embedCharaInPNG(arrayBuffer, charaData);

      const blob = new Blob([pngWithMetadata], { type: 'image/png' });
      
      return {
        success: true,
        blob,
        filename: `${this.sanitizeFilename(character.name)}.png`,
      };
    } catch (error) {
      console.error('PNG export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error exporting character',
      };
    }
  }

  /**
   * Export character as CharacterVault JSON (full data)
   */
  async exportAsCharacterVault(character: Character): Promise<ExportCharacterResult> {
    try {
      const exportData = {
        ...character,
        // Remove internal fields that shouldn't be exported
        id: character.id,
        name: character.name,
        imageData: character.imageData,
        data: character.data,
        version: character.version,
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
        lastOpenedAt: character.lastOpenedAt,
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      return {
        success: true,
        blob,
        filename: `${this.sanitizeFilename(character.name)}.charactervault.json`,
      };
    } catch (error) {
      console.error('CharacterVault export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error exporting character',
      };
    }
  }

  /**
   * Convert Character to full V3 Character Card format with nested structure
   */
  private characterToV3(character: Character): { spec: string; spec_version: string; data: CharacterCardV2 } {
    const cardData = this.characterDataToV2(character);
    
    return {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: cardData,
    };
  }

  /**
   * Convert Character to full V2 Character Card format with nested structure
   */
  private characterToV2Full(character: Character): { spec: string; spec_version: string; data: CharacterCardV2 } {
    const cardData = this.characterDataToV2(character);
    
    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: cardData,
    };
  }

  /**
   * Convert Character to Character Card V2/V3 data object (inner data only)
   */
  private characterDataToV2(character: Character): CharacterCardV2 {
    const spec = character.data.spec;
    const normalizedName = this.normalizeCardName(spec.name || character.name);
    
    return {
      name: normalizedName,
      description: spec.description,
      personality: spec.personality,
      scenario: spec.scenario,
      first_mes: spec.first_mes,
      mes_example: spec.mes_example,
      system_prompt: spec.system_prompt,
      post_history_instructions: spec.post_history_instructions,
      alternate_greetings: spec.alternate_greetings,
      character_book: character.data.characterBook,
      extensions: character.data.extensions || {},
      // V3 spec fields - use stored values or defaults
      creator: spec.creator || '',
      character_version: spec.character_version || '1.0',
      tags: spec.tags || [],
      creator_notes: spec.creator_notes || '',
      avatar: spec.avatar || '',
    };
  }

  /**
   * Normalize card name for broad importer compatibility.
   * Strips control characters/newlines and trims surrounding whitespace.
   */
  private normalizeCardName(name: string): string {
    const withoutControls = Array.from(name)
      .map((char) => {
        const code = char.charCodeAt(0);
        return code < 32 || code === 127 ? ' ' : char;
      })
      .join('');
    const cleaned = withoutControls.replace(/\s+/g, ' ').trim();
    return cleaned || 'Character';
  }

  /**
   * Embed character data into PNG tEXt chunk
   */
  private async embedCharaInPNG(imageBuffer: ArrayBuffer, charaData: string): Promise<ArrayBuffer> {
    // Read the original PNG
    const dataView = new DataView(imageBuffer);
    let offset = 0;

    // Check PNG signature
    const signature = new Uint8Array(imageBuffer, 0, 8);
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) {
      if (signature[i] !== pngSignature[i]) {
        throw new Error('Invalid PNG file signature');
      }
    }
    offset = 8;

    // Create output chunks
    const chunks: Uint8Array[] = [new Uint8Array(signature)];

    // Create tEXt chunk with character data
    const metadataChunk = this.createTextChunk('chara', charaData);

    // Insert tEXt chunk after IHDR
    let inserted = false;

    while (offset < imageBuffer.byteLength) {
      const length = dataView.getUint32(offset);
      const type = dataView.getUint32(offset + 4);
      const chunkPayload = new Uint8Array(imageBuffer, offset + 8, length);
      const chunkData = new Uint8Array(imageBuffer, offset, 12 + length);

      // Drop existing card metadata so importers don't pick stale data.
      if (this.isCardMetadataChunk(type, chunkPayload)) {
        offset += 12 + length;
        continue;
      }

      // Add the chunk
      chunks.push(chunkData);

      // Insert metadata chunk after IHDR
      if (type === 0x49484452 && !inserted) { // IHDR
        chunks.push(metadataChunk);
        inserted = true;
      }

      // Check for IEND
      if (type === 0x49454e44) {
        break;
      }

      offset += 12 + length;
    }

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    
    let resultOffset = 0;
    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }

    return result.buffer;
  }

  /**
   * Check whether a PNG text chunk contains character card metadata keys.
   */
  private isCardMetadataChunk(type: number, payload: Uint8Array): boolean {
    // tEXt
    if (type === 0x74455874) {
      return this.isCardKeyword(this.readKeyword(payload));
    }
    // iTXt
    if (type === 0x69545874) {
      return this.isCardKeyword(this.readKeyword(payload));
    }
    // zTXt
    if (type === 0x7a545874) {
      return this.isCardKeyword(this.readKeyword(payload));
    }
    return false;
  }

  /**
   * Check whether a metadata keyword is used for character card payloads.
   */
  private isCardKeyword(keyword: string): boolean {
    const key = keyword.toLowerCase();
    return key === 'chara' || key === 'ccv3';
  }

  /**
   * Read chunk keyword up to first null byte.
   */
  private readKeyword(payload: Uint8Array): string {
    let end = payload.length;
    for (let i = 0; i < payload.length; i++) {
      if (payload[i] === 0) {
        end = i;
        break;
      }
    }
    return new TextDecoder('utf-8').decode(payload.slice(0, end));
  }

  /**
   * Create PNG tEXt chunk
   */
  private createTextChunk(keyword: string, text: string): Uint8Array {
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    
    const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
    data.set(keywordBytes);
    data[keywordBytes.length] = 0; // Null separator
    data.set(textBytes, keywordBytes.length + 1);

    const chunk = new Uint8Array(12 + data.length);
    const dataView = new DataView(chunk.buffer);
    
    // Length
    dataView.setUint32(0, data.length);
    // Type (tEXt)
    chunk[4] = 0x74; // t
    chunk[5] = 0x45; // E
    chunk[6] = 0x58; // X
    chunk[7] = 0x74; // t
    // Data
    chunk.set(data, 8);
    // CRC
    const crc = this.calculateCRC(chunk.slice(4, 8 + data.length));
    dataView.setUint32(8 + data.length, crc);

    return chunk;
  }

  /**
   * Calculate CRC32 for PNG chunk
   */
  private calculateCRC(data: Uint8Array): number {
    const crcTable = this.getCRCTable();
    let crc = 0xffffffff;
    
    for (let i = 0; i < data.length; i++) {
      crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Get CRC lookup table
   */
  private getCRCTable(): Uint32Array {
    if (this.crcTable) {
      return this.crcTable;
    }

    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }

    this.crcTable = table;
    return table;
  }

  private crcTable: Uint32Array | null = null;

  /**
   * Convert data URL to Blob
   */
  private async dataURLToBlob(dataURL: string): Promise<Blob> {
    const response = await fetch(dataURL);
    return response.blob();
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  /**
   * Convert Unicode string to base64 (Unicode-safe)
   * Handles characters outside the Latin1 range that btoa() cannot process
   */
  private unicodeToBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * Singleton instance
 */
export const characterExportService = new CharacterExportService();
