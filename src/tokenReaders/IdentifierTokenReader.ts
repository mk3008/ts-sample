﻿import { BaseTokenReader } from './BaseTokenReader';
import { TokenType } from '../enums/tokenType';
import { Lexeme } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';

/**
 * Reads SQL identifier tokens
 */
export class IdentifierTokenReader extends BaseTokenReader {
    /**
     * Try to read an identifier token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];

        // MySQL escaped identifier (escape character is backtick)
        if (char === '`') {
            const identifier = this.readEscapedIdentifier('`');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        // Postgres escaped identifier (escape character is double quote)
        if (char === '"') {
            const identifier = this.readEscapedIdentifier('"');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        // SQLServer escaped identifier (escape character is square bracket)
        if (char === '[' && (previous === null || previous.command !== "array")) {
            const identifier = this.readEscapedIdentifier(']');
            return this.createLexeme(TokenType.Identifier, identifier);
        }

        // Regular identifier
        const start = this.position;
        while (this.canRead()) {
            if (CharLookupTable.isDelimiter(this.input[this.position])) {
                break;
            }
            this.position++;
        }

        if (start === this.position) {
            return null;
        }

        return this.createLexeme(
            TokenType.Identifier,
            this.input.slice(start, this.position)
        );
    }

    /**
     * Read an escaped identifier (surrounded by delimiters)
     */
    private readEscapedIdentifier(delimiter: string): string {
        const start = this.position;

        // Skip the opening delimiter
        this.position++;

        while (this.canRead()) {
            if (this.input[this.position] === delimiter) {
                break;
            }
            this.position++;
        }
        
        if (start === this.position) {
            throw new Error(`Closing delimiter is not found. position: ${start}, delimiter: ${delimiter}\n${this.getDebugPositionInfo(start)}}`);
        }

        // Skip the closing delimiter
        this.position++;

        // exclude the delimiter
        return this.input.slice(start + 1, this.position - 1);
    }
}
