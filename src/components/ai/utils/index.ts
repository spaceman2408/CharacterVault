/**
 * @fileoverview Utility functions for AI chat components.
 * @module components/ai/utils
 */

/**
 * Format timestamp for display
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate unique message ID
 * @returns Unique message ID string in format "msg_{timestamp}_{random}"
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
