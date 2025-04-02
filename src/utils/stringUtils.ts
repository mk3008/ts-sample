﻿import { CharLookupTable } from "./charLookupTable";

/**
 * Utilities for string operations during tokenization
 */
export class StringUtils {
    /**
     * Creates a visual representation of an error position in text
     * @param input The input text
     * @param errPosition The error position
     * @returns A string with a caret pointing to the error position
     */
    public static getDebugPositionInfo(input: string, errPosition: number): string {
        // Get 5 characters before and after the error
        // If the start and end points are out of the string range, keep them within the range
        // Display ^ at the error position on the next line
        const start = Math.max(0, errPosition - 5);
        const end = Math.min(input.length, errPosition + 5);
        const debugInfo = input.slice(start, end);
        const caret = ' '.repeat(errPosition - start) + '^';
        return `${debugInfo}\n${caret}`;
    }

    /**
     * Skip white space characters.
     */
    private static skipWhiteSpace(input: string, position: number): number {
        const length = input.length;

        while (position < length) {
            const charCode = input.charCodeAt(position);
            // ' '=32, '\t'=9, '\n'=10, '\r'=13
            if (charCode !== 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
                break;
            }
            position++;
        }

        return position;
    }

    /**
     * Skip line comment.
     */
    private static readLineComment(input: string, position: number): { newPosition: number, comment: string | null } {
        if (position + 1 >= input.length) {
            return { newPosition: position, comment: null };
        }

        // '-'=45
        if (input.charCodeAt(position) === 45 && input.charCodeAt(position + 1) === 45) {
            const start = position;
            position += 2;

            // '\n'=10
            while (position < input.length && input.charCodeAt(position) !== 10) {
                position++;
            }

            // Return the trimmed comment content (excluding -- tokens)
            const comment = input.slice(start + 2, position).trim();
            return { newPosition: position, comment };
        }
        return { newPosition: position, comment: null };
    }

    /**
     * Skip block comment.
     */
    private static readBlockComment(input: string, position: number): { newPosition: number, comments: string[] | null } {
        if (position + 3 >= input.length) {
            return { newPosition: position, comments: null };
        }

        // '/'=47, '*'=42, '+'=43
        if (input.charCodeAt(position) === 47 && input.charCodeAt(position + 1) === 42 && input.charCodeAt(position + 2) !== 43) {
            const start = position;
            position += 2;

            while (position + 1 < input.length) {
                // '*'=42, '/'=47
                if (input.charCodeAt(position) === 42 && input.charCodeAt(position + 1) === 47) {
                    position += 2;

                    // Process the comment content
                    const lines = input.slice(start + 2, position - 2).replace(/\r/g, '').split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        lines[i] = lines[i].trim();
                    }

                    // Remove empty lines, but only at the beginning and end
                    while (lines.length > 0 && lines[0] === '') {
                        lines.shift();
                    }
                    while (lines.length > 0 && lines[lines.length - 1] === '') {
                        lines.pop();
                    }

                    return { newPosition: position, comments: lines };
                }
                position++;
            }
            throw new Error(`Block comment is not closed. position: ${position}`);
        }
        return { newPosition: position, comments: null };
    }

    /**
     * Skip white space characters and SQL comments.
     * @returns Object containing the new position and an array of skipped comments
     */
    public static readWhiteSpaceAndComment(input: string, position: number): { position: number, lines: string[] } {
        const lines: string[] = [];
        const length = input.length;

        while (position < length) {
            // Store current position
            const oldPosition = position;

            // Skip whitespace first
            position = StringUtils.skipWhiteSpace(input, position);
            if (position !== oldPosition) {
                continue;
            }

            // Fast character code check
            const charCode = input.charCodeAt(position);

            // '-'=45 (Line comment)
            if (charCode === 45) {
                const lineCommentResult = StringUtils.readLineComment(input, position);
                if (lineCommentResult.newPosition !== position) {
                    position = lineCommentResult.newPosition;
                    if (lineCommentResult.comment) {
                        lines.push(lineCommentResult.comment.trim());
                    }
                    continue;
                }
            }
            // '/'=47 (Block comment)
            else if (charCode === 47) {
                const blockCommentResult = StringUtils.readBlockComment(input, position);
                if (blockCommentResult.newPosition !== position) {
                    position = blockCommentResult.newPosition;
                    if (blockCommentResult.comments) {
                        lines.push(...blockCommentResult.comments);
                    }
                    continue;
                }
            }

            // No more whitespace or comments found
            break;
        }

        return { position, lines: lines };
    }

    /**
     * Read a regular identifier.
     */
    public static readRegularIdentifier(input: string, position: number): { identifier: string, newPosition: number } {
        const result = this.tryReadRegularIdentifier(input, position);

        if (!result) {
            throw new Error(`Unexpected character. position: ${position}\n${StringUtils.getDebugPositionInfo(input, position)}`);
        }

        return result;
    }

    public static tryReadRegularIdentifier(input: string, position: number): { identifier: string, newPosition: number } | null {
        const start = position;

        while (position < input.length) {
            if (CharLookupTable.isDelimiter(input[position])) {
                break;
            }
            position++;
        }

        if (start === position) {
            return null;
        }

        return {
            identifier: input.slice(start, position),
            newPosition: position
        };
    }
}
